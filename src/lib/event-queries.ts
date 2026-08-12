import { and, desc, eq, gte, like, or, sql, asc } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { events, eventAttendees, users } from "@/db/schema";
import type * as schema from "@/db/schema";

type Db = DrizzleD1Database<typeof schema>;

export interface EventFilters {
  search?: string;
  city?: string;
  audience?: "mixed" | "women_only" | "family";
  category?: string;
}

export interface EventListItem {
  id: string;
  slug: string;
  titleEn: string;
  titleAr: string | null;
  startsAt: number;
  timezone: string;
  city: string | null;
  venueName: string | null;
  capacity: number;
  minHeadcount: number;
  totalCostFils: number;
  priceFloorFils: number;
  priceCeilingFils: number;
  audience: "mixed" | "women_only" | "family";
  coverImageKey: string | null;
  joinedCount: number;
}

/**
 * Correlated subquery counting an event's confirmed attendees.
 *
 * Written with RAW column names, not Drizzle table objects. Interpolating
 * `${eventAttendees}` into a `sql` template inside a subquery does not reliably
 * emit a correlatable alias — Drizzle can alias the outer table, so the
 * correlation matches nothing and the count is silently 0. That failure is
 * plausible rather than obvious: zero is a valid count, and prices simply sit
 * at the ceiling, which is exactly how a genuinely empty event looks.
 *
 * Verified against raw SQL: this returns 8/34/7 where the interpolated version
 * returned 0/0/0.
 */
const joinedCountSql = sql<number>`(
  SELECT COUNT(*) FROM event_attendees
  WHERE event_attendees.event_id = events.id
    AND event_attendees.status = 'joined'
)`;

/**
 * Published, upcoming events, soonest first.
 *
 * Counts via the correlated subquery above rather than JOIN + GROUP BY: a
 * GROUP BY needs a LEFT JOIN plus NULL handling for zero-attendee events, and
 * multiplies rows before aggregating. The subquery hits idx_attendees_event.
 *
 * Every filter column is indexed — see AGENTS.md on D1's free-tier row budget.
 */
export async function listEvents(
  db: Db,
  filters: EventFilters = {},
  options: { limit?: number; now?: number } = {},
): Promise<EventListItem[]> {
  const now = options.now ?? Date.now();
  const limit = Math.min(options.limit ?? 50, 100);

  const conditions = [
    or(eq(events.status, "published"), eq(events.status, "confirmed")),
    gte(events.startsAt, now),
  ];

  if (filters.city) conditions.push(eq(events.city, filters.city));
  if (filters.audience) conditions.push(eq(events.audience, filters.audience));
  if (filters.category) conditions.push(eq(events.category, filters.category));

  if (filters.search?.trim()) {
    // LIKE with a leading wildcard cannot use an index, so this is a scan.
    // Acceptable at Slice 1 volumes; FTS5 replaces it when the table grows.
    const term = `%${filters.search.trim()}%`;
    conditions.push(
      or(
        like(events.titleEn, term),
        like(events.titleAr, term),
        like(events.venueName, term),
        like(events.city, term),
      )!,
    );
  }

  return db
    .select({
      id: events.id,
      slug: events.slug,
      titleEn: events.titleEn,
      titleAr: events.titleAr,
      startsAt: events.startsAt,
      timezone: events.timezone,
      city: events.city,
      venueName: events.venueName,
      capacity: events.capacity,
      minHeadcount: events.minHeadcount,
      totalCostFils: events.totalCostFils,
      priceFloorFils: events.priceFloorFils,
      priceCeilingFils: events.priceCeilingFils,
      audience: events.audience,
      coverImageKey: events.coverImageKey,
      joinedCount: joinedCountSql,
    })
    .from(events)
    .where(and(...conditions))
    .orderBy(asc(events.startsAt))
    .limit(limit);
}

export interface EventDetail extends EventListItem {
  descriptionEn: string | null;
  descriptionAr: string | null;
  endsAt: number | null;
  status: string;
  organizerId: string;
  organizerName: string | null;
  organizerAvatarUrl: string | null;
}

/** Single event by slug, with organizer details for the byline. */
export async function getEventBySlug(
  db: Db,
  slug: string,
): Promise<EventDetail | null> {
  const row = await db
    .select({
      id: events.id,
      slug: events.slug,
      titleEn: events.titleEn,
      titleAr: events.titleAr,
      descriptionEn: events.descriptionEn,
      descriptionAr: events.descriptionAr,
      startsAt: events.startsAt,
      endsAt: events.endsAt,
      timezone: events.timezone,
      city: events.city,
      venueName: events.venueName,
      capacity: events.capacity,
      minHeadcount: events.minHeadcount,
      totalCostFils: events.totalCostFils,
      priceFloorFils: events.priceFloorFils,
      priceCeilingFils: events.priceCeilingFils,
      audience: events.audience,
      coverImageKey: events.coverImageKey,
      status: events.status,
      organizerId: events.organizerId,
      organizerName: users.displayName,
      organizerAvatarUrl: users.avatarUrl,
      joinedCount: joinedCountSql,
    })
    .from(events)
    .innerJoin(users, eq(events.organizerId, users.id))
    .where(eq(events.slug, slug))
    .get();

  return row ?? null;
}

/** Whether this user currently holds a seat. Drives the join/leave button. */
export async function hasJoined(
  db: Db,
  eventId: string,
  userId: string,
): Promise<boolean> {
  const row = await db
    .select({ id: eventAttendees.id })
    .from(eventAttendees)
    .where(
      and(
        eq(eventAttendees.eventId, eventId),
        eq(eventAttendees.userId, userId),
        eq(eventAttendees.status, "joined"),
      ),
    )
    .get();

  return Boolean(row);
}

/** Local user row for a Clerk ID. Null until the webhook has synced them. */
export async function getUserByClerkId(db: Db, clerkUserId: string) {
  return (
    (await db
      .select()
      .from(users)
      .where(eq(users.clerkUserId, clerkUserId))
      .get()) ?? null
  );
}

/** Distinct cities that currently have events, for the filter dropdown. */
export async function listCities(db: Db, now = Date.now()): Promise<string[]> {
  const rows = await db
    .selectDistinct({ city: events.city })
    .from(events)
    .where(
      and(
        or(eq(events.status, "published"), eq(events.status, "confirmed")),
        gte(events.startsAt, now),
      ),
    )
    .orderBy(desc(events.city));

  return rows.map((r) => r.city).filter((c): c is string => Boolean(c));
}
