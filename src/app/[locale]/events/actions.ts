"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { events } from "@/db/schema";
import { getUserByClerkId } from "@/lib/event-queries";
import { joinEvent, leaveEvent } from "@/lib/join-event";
import { slugify, validateEventInput, type EventInput } from "@/lib/events";
import { aedToFils } from "@/lib/format";

export type CreateEventState =
  | { status: "idle" }
  | { status: "error"; message: string; fieldErrors?: Record<string, string> }
  | { status: "success"; slug: string };

/**
 * Creates an event.
 *
 * Auth is enforced here rather than in middleware — per Clerk's guidance, a
 * matcher mistake must never be able to expose a mutation.
 */
export async function createEventAction(
  _prev: CreateEventState,
  formData: FormData,
): Promise<CreateEventState> {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) {
    return { status: "error", message: "unauthorized" };
  }

  const db = await getDb();
  const user = await getUserByClerkId(db, clerkUserId);
  if (!user) {
    // The Clerk webhook has not synced this user yet. Rare, but possible
    // immediately after signup.
    return { status: "error", message: "profile_not_ready" };
  }

  const str = (k: string) => (formData.get(k)?.toString() ?? "").trim();
  const num = (k: string) => Number(formData.get(k) ?? 0);

  // Datetime-local inputs are wall-clock in the event's zone, with no offset.
  // Interpreting them as UTC would shift every event by the zone offset.
  const timezone = str("timezone") || "Asia/Dubai";
  const startsAt = parseLocalDateTime(str("startsAt"), timezone);
  const endsAtRaw = str("endsAt");
  const endsAt = endsAtRaw ? parseLocalDateTime(endsAtRaw, timezone) : undefined;

  const input: EventInput = {
    titleEn: str("titleEn"),
    titleAr: str("titleAr") || undefined,
    descriptionEn: str("descriptionEn") || undefined,
    descriptionAr: str("descriptionAr") || undefined,
    startsAt,
    endsAt,
    timezone,
    venueName: str("venueName") || undefined,
    city: str("city") || undefined,
    capacity: num("capacity"),
    minHeadcount: num("minHeadcount"),
    // The form collects AED; everything downstream is fils.
    totalCostFils: aedToFils(num("totalCost")),
    priceFloorFils: aedToFils(num("priceFloor")),
    priceCeilingFils: aedToFils(num("priceCeiling")),
    audience: (str("audience") || "mixed") as EventInput["audience"],
    category: str("category") || undefined,
  };

  const validation = validateEventInput(input);
  if (!validation.ok) {
    return {
      status: "error",
      message: "validation",
      fieldErrors: validation.errors as Record<string, string>,
    };
  }

  // Arabic titles produce Arabic slugs; fall back to a random suffix when the
  // title yields nothing URL-safe.
  const base = slugify(input.titleAr || input.titleEn) || "event";
  const slug = `${base}-${crypto.randomUUID().slice(0, 6)}`;

  const id = crypto.randomUUID();
  const now = Date.now();

  await db.insert(events).values({
    id,
    slug,
    organizerId: user.id,
    titleEn: input.titleEn,
    titleAr: input.titleAr ?? null,
    descriptionEn: input.descriptionEn ?? null,
    descriptionAr: input.descriptionAr ?? null,
    startsAt: input.startsAt,
    endsAt: input.endsAt ?? null,
    timezone: input.timezone,
    venueName: input.venueName ?? null,
    city: input.city ?? null,
    capacity: input.capacity,
    minHeadcount: input.minHeadcount,
    totalCostFils: input.totalCostFils,
    priceFloorFils: input.priceFloorFils,
    priceCeilingFils: input.priceCeilingFils,
    audience: input.audience,
    category: input.category ?? null,
    status: "published",
    createdAt: now,
    updatedAt: now,
  });

  revalidatePath("/[locale]/events", "page");

  return { status: "success", slug };
}

export type JoinState =
  | { status: "idle" }
  | { status: "error"; reason: string }
  | { status: "success" };

/** Adds the signed-in user to an event via the atomic capacity guard. */
export async function joinEventAction(
  _prev: JoinState,
  formData: FormData,
): Promise<JoinState> {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) return { status: "error", reason: "unauthorized" };

  const eventId = formData.get("eventId")?.toString();
  const slug = formData.get("slug")?.toString();
  if (!eventId) return { status: "error", reason: "invalid" };

  const db = await getDb();
  const user = await getUserByClerkId(db, clerkUserId);
  if (!user) return { status: "error", reason: "profile_not_ready" };

  const result = await joinEvent(db, { eventId, userId: user.id });

  if (!result.ok) return { status: "error", reason: result.reason };

  if (slug) revalidatePath(`/[locale]/events/${slug}`, "page");
  revalidatePath("/[locale]/events", "page");

  return { status: "success" };
}

/** Releases the signed-in user's seat. */
export async function leaveEventAction(
  _prev: JoinState,
  formData: FormData,
): Promise<JoinState> {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) return { status: "error", reason: "unauthorized" };

  const eventId = formData.get("eventId")?.toString();
  const slug = formData.get("slug")?.toString();
  if (!eventId) return { status: "error", reason: "invalid" };

  const db = await getDb();
  const user = await getUserByClerkId(db, clerkUserId);
  if (!user) return { status: "error", reason: "profile_not_ready" };

  await leaveEvent(db, { eventId, userId: user.id });

  if (slug) revalidatePath(`/[locale]/events/${slug}`, "page");
  revalidatePath("/[locale]/events", "page");

  return { status: "success" };
}

/** Deletes an event. Only its organizer may do so. */
export async function deleteEventAction(formData: FormData): Promise<void> {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) return;

  const eventId = formData.get("eventId")?.toString();
  if (!eventId) return;

  const db = await getDb();
  const user = await getUserByClerkId(db, clerkUserId);
  if (!user) return;

  const event = await db.query.events.findFirst({
    where: eq(events.id, eventId),
  });
  // Ownership check: never trust a client-supplied id alone.
  if (!event || event.organizerId !== user.id) return;

  await db.delete(events).where(eq(events.id, eventId));
  revalidatePath("/[locale]/events", "page");
}

/**
 * Converts a `datetime-local` value ("2026-09-01T19:00") to epoch millis,
 * interpreting the wall-clock time in the given IANA zone.
 *
 * `new Date("2026-09-01T19:00")` uses the SERVER's zone — meaningless on a
 * Worker that may run anywhere. This computes the zone's offset at that instant
 * and corrects for it.
 */
function parseLocalDateTime(value: string, timezone: string): number {
  if (!value) return NaN;

  const asUtc = Date.parse(`${value}:00.000Z`);
  if (Number.isNaN(asUtc)) return NaN;

  // Offset can shift across DST boundaries, so measure it at the target instant.
  const offset = timezoneOffsetMillis(asUtc, timezone);
  return asUtc - offset;
}

/** Milliseconds `timezone` is ahead of UTC at the given instant. */
function timezoneOffsetMillis(epochMillis: number, timezone: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  const parts = Object.fromEntries(
    dtf.formatToParts(new Date(epochMillis)).map((p) => [p.type, p.value]),
  );

  const asIfUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour === "24" ? "0" : parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );

  return asIfUtc - epochMillis;
}
