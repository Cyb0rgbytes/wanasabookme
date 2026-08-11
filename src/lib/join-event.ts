import { and, eq, sql } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { events, eventAttendees } from "@/db/schema";
import type * as schema from "@/db/schema";
import { computeSettledPrice, type CostSplitConfig } from "./pricing";

export type JoinResult =
  | { ok: true; attendeeId: string; joinPriceFils: number }
  | {
      ok: false;
      reason:
        | "event_not_found"
        | "not_published"
        | "already_joined"
        | "sold_out"
        | "already_started";
    };

/**
 * Adds a user to an event, refusing to oversell.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * THE RACE THIS PREVENTS
 *
 * The obvious implementation is fatally wrong:
 *
 *     const count = await db.select(count()).from(attendees)   // reads 19
 *     if (count < capacity) await db.insert(...)               // both insert
 *
 * Two requests for the last seat both read 19, both conclude there is room,
 * and both insert. Capacity 20, tickets sold 21.
 *
 * D1 does not support interactive transactions — each statement is a separate
 * round-trip to a Durable Object, so BEGIN/COMMIT spanning reads and writes is
 * unavailable. Instead the check and the write are ONE statement:
 *
 *     INSERT INTO event_attendees (...)
 *     SELECT ... WHERE (SELECT COUNT(*) ...) < capacity
 *
 * SQLite evaluates the subquery and performs the insert atomically. The loser
 * of the race inserts zero rows, and `meta.changes === 0` reports that.
 *
 * The UNIQUE(event_id, user_id) constraint is the second line of defence,
 * catching double-joins that slip past the application-level check.
 * ─────────────────────────────────────────────────────────────────────────
 */
export async function joinEvent(
  db: DrizzleD1Database<typeof schema>,
  params: { eventId: string; userId: string; now?: number },
): Promise<JoinResult> {
  const now = params.now ?? Date.now();

  const event = await db.query.events.findFirst({
    where: eq(events.id, params.eventId),
  });

  if (!event) return { ok: false, reason: "event_not_found" };
  if (event.status !== "published" && event.status !== "confirmed") {
    return { ok: false, reason: "not_published" };
  }
  if (event.startsAt <= now) return { ok: false, reason: "already_started" };

  const existing = await db.query.eventAttendees.findFirst({
    where: and(
      eq(eventAttendees.eventId, params.eventId),
      eq(eventAttendees.userId, params.userId),
    ),
  });
  if (existing && existing.status === "joined") {
    return { ok: false, reason: "already_joined" };
  }

  // The price this attendee is quoted becomes their personal cap. It reflects
  // the headcount INCLUDING them, so the number does not move the instant they
  // join. See getPricingSnapshot in pricing.ts.
  const config: CostSplitConfig = {
    totalCostFils: event.totalCostFils,
    minHeadcount: event.minHeadcount,
    capacity: event.capacity,
    priceFloorFils: event.priceFloorFils,
    priceCeilingFils: event.priceCeilingFils,
  };

  const currentCount = await countJoined(db, params.eventId);
  const joinPriceFils = computeSettledPrice(config, currentCount + 1);

  const attendeeId = crypto.randomUUID();

  // Atomic guarded insert. The WHERE clause is evaluated by SQLite as part of
  // the same statement, so a concurrent join cannot slip between check and write.
  const result = await db.run(sql`
    INSERT INTO event_attendees (id, event_id, user_id, join_price_fils, status, joined_at)
    SELECT
      ${attendeeId},
      ${params.eventId},
      ${params.userId},
      ${joinPriceFils},
      'joined',
      ${now}
    WHERE (
      SELECT COUNT(*) FROM event_attendees
      WHERE event_id = ${params.eventId} AND status = 'joined'
    ) < ${event.capacity}
    ON CONFLICT (event_id, user_id) DO UPDATE SET
      status = 'joined',
      join_price_fils = excluded.join_price_fils,
      joined_at = excluded.joined_at
  `);

  // Zero rows changed means the capacity guard rejected the insert.
  if (!result.meta?.changes) return { ok: false, reason: "sold_out" };

  return { ok: true, attendeeId, joinPriceFils };
}

/** Number of attendees currently holding a seat. */
export async function countJoined(
  db: DrizzleD1Database<typeof schema>,
  eventId: string,
): Promise<number> {
  const row = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(eventAttendees)
    .where(
      and(
        eq(eventAttendees.eventId, eventId),
        eq(eventAttendees.status, "joined"),
      ),
    )
    .get();

  return row?.count ?? 0;
}

/**
 * Releases a seat.
 *
 * Marks the row cancelled rather than deleting it, so the join history
 * survives for later refund reconciliation in Slice 2.
 */
export async function leaveEvent(
  db: DrizzleD1Database<typeof schema>,
  params: { eventId: string; userId: string },
): Promise<{ ok: boolean }> {
  const result = await db
    .update(eventAttendees)
    .set({ status: "cancelled" })
    .where(
      and(
        eq(eventAttendees.eventId, params.eventId),
        eq(eventAttendees.userId, params.userId),
        eq(eventAttendees.status, "joined"),
      ),
    );

  return { ok: Boolean(result.meta?.changes) };
}
