import { getDb } from "@/db";
import { events, users } from "@/db/schema";
import { assertTestEndpointsEnabled } from "../guard";

/**
 * Seeds an event and N users for the capacity-race test.
 * DEV ONLY — see ../guard.ts.
 */
export async function POST(req: Request) {
  const denied = assertTestEndpointsEnabled();
  if (denied) return denied;

  const { capacity = 3, userCount = 12 } = (await req.json()) as {
    capacity?: number;
    userCount?: number;
  };

  const db = await getDb();
  const now = Date.now();
  const eventId = crypto.randomUUID();

  const organizerId = crypto.randomUUID();
  await db.insert(users).values({
    id: organizerId,
    clerkUserId: `user_racetest_org_${now}`,
    email: `race-org-${now}@test.local`,
    displayName: "Race Organizer",
    createdAt: now,
    updatedAt: now,
  });

  await db.insert(events).values({
    id: eventId,
    slug: `race-test-${now}`,
    organizerId,
    titleEn: "Race Test Event",
    startsAt: now + 86_400_000,
    timezone: "Asia/Dubai",
    capacity,
    minHeadcount: 1,
    totalCostFils: 100_000,
    priceFloorFils: 0,
    priceCeilingFils: 100_000,
    audience: "mixed",
    status: "published",
    createdAt: now,
    updatedAt: now,
  });

  const userIds: string[] = [];
  for (let i = 0; i < userCount; i++) {
    const id = crypto.randomUUID();
    userIds.push(id);
    await db.insert(users).values({
      id,
      clerkUserId: `user_racetest_${now}_${i}`,
      email: `race-${now}-${i}@test.local`,
      displayName: `Racer ${i}`,
      createdAt: now,
      updatedAt: now,
    });
  }

  return Response.json({ eventId, userIds });
}
