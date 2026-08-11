import { sql } from "drizzle-orm";
import { index, sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

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
