import { verifyWebhook } from "@clerk/nextjs/webhooks";
import type { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { users } from "@/db/schema";

/**
 * Clerk → D1 user sync.
 *
 * Clerk owns identity; this keeps a local mirror so events can hold a stable
 * foreign key and listings can render organizer details without an API call
 * per row.
 *
 * Security: `verifyWebhook` checks the Svix signature against
 * CLERK_WEBHOOK_SIGNING_SECRET. It MUST run before anything is read from the
 * body — the payload is attacker-controlled until that check passes. No
 * session is required, which is why this route sits outside the auth-protected
 * area.
 *
 * Idempotency: webhooks retry and can arrive out of order, so every branch is
 * an upsert or a tolerant delete. Receiving the same event twice must be a
 * no-op, never a duplicate row or a 500 that triggers yet another retry.
 */
export async function POST(req: NextRequest) {
  let evt;

  try {
    evt = await verifyWebhook(req);
  } catch (err) {
    // Signature failure = unauthenticated caller. 400 (not 500) so Clerk stops
    // retrying; a retry cannot fix a bad signature.
    console.error(
      JSON.stringify({
        event: "clerk_webhook_verify_failed",
        error: err instanceof Error ? err.message : String(err),
      }),
    );
    return new Response("Invalid signature", { status: 400 });
  }

  const db = await getDb();

  try {
    switch (evt.type) {
      case "user.created":
      case "user.updated": {
        const data = evt.data;

        // Clerk permits multiple emails; the primary one is authoritative.
        const primaryEmail =
          data.email_addresses?.find(
            (e) => e.id === data.primary_email_address_id,
          )?.email_address ?? data.email_addresses?.[0]?.email_address;

        if (!primaryEmail) {
          // Nothing to key on. Ack so Clerk stops retrying — a retry will not
          // add an email that was never there.
          console.error(
            JSON.stringify({
              event: "clerk_webhook_no_email",
              clerkUserId: data.id,
            }),
          );
          return new Response("No email address on user", { status: 200 });
        }

        const displayName =
          [data.first_name, data.last_name].filter(Boolean).join(" ").trim() ||
          data.username ||
          null;

        const now = Date.now();

        await db
          .insert(users)
          .values({
            // crypto.randomUUID, never Math.random — this is an identifier.
            id: crypto.randomUUID(),
            clerkUserId: data.id,
            email: primaryEmail,
            displayName,
            avatarUrl: data.image_url ?? null,
            createdAt: now,
            updatedAt: now,
          })
          .onConflictDoUpdate({
            target: users.clerkUserId,
            set: {
              email: primaryEmail,
              displayName,
              avatarUrl: data.image_url ?? null,
              updatedAt: now,
            },
          });

        console.log(
          JSON.stringify({
            event: "clerk_webhook_user_synced",
            type: evt.type,
            clerkUserId: data.id,
          }),
        );
        break;
      }

      case "user.deleted": {
        const clerkUserId = evt.data.id;
        if (clerkUserId) {
          await db.delete(users).where(eq(users.clerkUserId, clerkUserId));
          console.log(
            JSON.stringify({
              event: "clerk_webhook_user_deleted",
              clerkUserId,
            }),
          );
        }
        break;
      }

      default:
        // Unsubscribed event types are fine to ignore, but log them so an
        // accidental dashboard subscription is visible rather than silent.
        console.log(
          JSON.stringify({
            event: "clerk_webhook_ignored",
            type: evt.type,
          }),
        );
    }

    return new Response("OK", { status: 200 });
  } catch (err) {
    // 500 tells Clerk to retry — correct for transient DB failures, and safe
    // because every handler above is idempotent.
    console.error(
      JSON.stringify({
        event: "clerk_webhook_handler_failed",
        type: evt.type,
        error: err instanceof Error ? err.message : String(err),
      }),
    );
    return new Response("Handler error", { status: 500 });
  }
}
