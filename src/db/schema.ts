import { sql } from "drizzle-orm";
import {
  index,
  sqliteTable,
  text,
  integer,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

/**
 * Users mirrored from Clerk.
 *
 * Clerk owns identity; this table exists so events and attendance can hold a
 * stable local foreign key, and so listings can render an organizer's name and
 * avatar without an API round-trip per row.
 *
 * Rows are written ONLY by the Clerk webhook (src/app/api/webhooks/clerk).
 * Never create a user here from application code — Clerk is the source of
 * truth, and a locally-invented row would drift permanently.
 */
export const users = sqliteTable(
  "users",
  {
    /** Local UUID. Kept separate from Clerk's ID so a future auth swap is survivable. */
    id: text("id").primaryKey(),

    /** Clerk's user ID (`user_...`). The join key for webhook upserts. */
    clerkUserId: text("clerk_user_id").notNull().unique(),

    email: text("email").notNull(),
    displayName: text("display_name"),
    avatarUrl: text("avatar_url"),

    /** Preferred locale, used for outbound email. Null until the user chooses. */
    preferredLocale: text("preferred_locale", { enum: ["en", "ar"] }),

    /** Epoch millis. SQLite has no native timestamp; integers sort and compare cleanly. */
    createdAt: integer("created_at")
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    updatedAt: integer("updated_at")
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (table) => [
    // The webhook looks users up by Clerk ID on every event; without this index
    // each upsert is a full table scan, which burns the D1 free-tier row budget.
    index("idx_users_clerk_user_id").on(table.clerkUserId),
  ],
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

/**
 * Events.
 *
 * Bilingual by construction: title/description exist in both languages rather
 * than in a single field with a locale column. An event listing must be
 * readable in whichever language the visitor is browsing, and a translation
 * table would mean a join on every row of every listing.
 *
 * ALL MONEY IS INTEGER FILS (1 AED = 100 fils). See src/lib/pricing.ts.
 */
export const events = sqliteTable(
  "events",
  {
    id: text("id").primaryKey(),

    /** URL segment, e.g. /en/events/desert-bbq-abu-dhabi. Globally unique. */
    slug: text("slug").notNull().unique(),

    organizerId: text("organizer_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    // --- Bilingual content ---
    // English is required as the fallback; Arabic is optional so an organizer
    // is never blocked from publishing, but the UI should push for both.
    titleEn: text("title_en").notNull(),
    titleAr: text("title_ar"),
    descriptionEn: text("description_en"),
    descriptionAr: text("description_ar"),

    // --- When ---
    /** Epoch millis, UTC. Always store UTC; convert at the display edge. */
    startsAt: integer("starts_at").notNull(),
    endsAt: integer("ends_at"),
    /** IANA zone, e.g. "Asia/Dubai". Needed to render the organizer's intent. */
    timezone: text("timezone").notNull().default("Asia/Dubai"),

    // --- Where ---
    venueName: text("venue_name"),
    city: text("city"),
    /** Decimal degrees. D1 has no PostGIS, so geo-search is bounding-box maths. */
    latitude: integer("latitude"),
    longitude: integer("longitude"),

    // --- Cost split (mirrors CostSplitConfig in src/lib/pricing.ts) ---
    totalCostFils: integer("total_cost_fils").notNull().default(0),
    capacity: integer("capacity").notNull(),
    minHeadcount: integer("min_headcount").notNull().default(1),
    priceFloorFils: integer("price_floor_fils").notNull().default(0),
    priceCeilingFils: integer("price_ceiling_fils").notNull(),

    // --- Regional settings ---
    /** A standard, expected filter in this market — not an edge case. */
    audience: text("audience", {
      enum: ["mixed", "women_only", "family"],
    })
      .notNull()
      .default("mixed"),

    category: text("category"),

    // --- Lifecycle ---
    status: text("status", {
      enum: ["draft", "published", "confirmed", "cancelled", "completed"],
    })
      .notNull()
      .default("draft"),

    /** R2 object key for the cover image. Never a full URL — the host can change. */
    coverImageKey: text("cover_image_key"),

    createdAt: integer("created_at")
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    updatedAt: integer("updated_at")
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (table) => [
    // Every column below appears in a listing filter or sort. Unindexed scans
    // burn the D1 free-tier row-read budget fast — see AGENTS.md.
    index("idx_events_slug").on(table.slug),
    index("idx_events_organizer").on(table.organizerId),
    index("idx_events_starts_at").on(table.startsAt),
    index("idx_events_city").on(table.city),
    index("idx_events_category").on(table.category),
    index("idx_events_audience").on(table.audience),
    // The browse page's default query: published events, soonest first.
    index("idx_events_status_starts_at").on(table.status, table.startsAt),
  ],
);

export type Event = typeof events.$inferSelect;
export type NewEvent = typeof events.$inferInsert;

/**
 * Attendance.
 *
 * `pricePaidFils` is NOT the final charge — it is the price the attendee saw
 * and agreed to when joining, which acts as their personal cap. The amount
 * actually charged is `min(joinTimePrice, settledPrice)`; see
 * resolveAttendeePrice in src/lib/pricing.ts.
 *
 * Rows are created ONLY inside a transaction that re-checks capacity. A
 * read-then-write will oversell the event under concurrent joins.
 */
export const eventAttendees = sqliteTable(
  "event_attendees",
  {
    id: text("id").primaryKey(),

    eventId: text("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),

    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    /** Price quoted at join time, in fils. A personal ceiling, not a charge. */
    joinPriceFils: integer("join_price_fils").notNull(),

    status: text("status", {
      enum: ["joined", "cancelled", "attended", "no_show"],
    })
      .notNull()
      .default("joined"),

    joinedAt: integer("joined_at")
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (table) => [
    // Database-level guarantee that one user cannot join the same event twice.
    // Application checks race; this constraint does not.
    uniqueIndex("uniq_event_attendee").on(table.eventId, table.userId),
    index("idx_attendees_event").on(table.eventId),
    index("idx_attendees_user").on(table.userId),
  ],
);

export type EventAttendee = typeof eventAttendees.$inferSelect;
export type NewEventAttendee = typeof eventAttendees.$inferInsert;
