import { getDb } from "@/db";
import { events, eventAttendees, users } from "@/db/schema";
import { computeSettledPrice } from "@/lib/pricing";
import { assertTestEndpointsEnabled } from "../guard";

/**
 * Seeds realistic bilingual events for visual verification.
 * DEV ONLY — see ../guard.ts.
 */
export async function POST() {
  const denied = assertTestEndpointsEnabled();
  if (denied) return denied;

  const db = await getDb();
  const now = Date.now();
  const day = 86_400_000;

  const organizerId = crypto.randomUUID();
  await db.insert(users).values({
    id: organizerId,
    clerkUserId: `user_demo_org_${now}`,
    email: `demo-${now}@test.local`,
    displayName: "Omar Al Mansouri",
    createdAt: now,
    updatedAt: now,
  });

  const specs = [
    {
      slug: `desert-bbq-${now}`,
      titleEn: "Desert BBQ under the stars",
      titleAr: "شواء في الصحراء تحت النجوم",
      descriptionEn:
        "An evening in the Al Marmoom dunes — grilled food, a bonfire, and stargazing once the sun goes down. Transport from Dubai included.",
      descriptionAr:
        "أمسية في كثبان المرموم — طعام مشوي، ونار مخيّم، ومراقبة للنجوم بعد الغروب. المواصلات من دبي مشمولة.",
      startsAt: now + day * 12,
      venueName: "Al Marmoom Desert Conservation Reserve",
      city: "Dubai",
      capacity: 20,
      minHeadcount: 6,
      totalCostFils: 240_000, // 2400 AED
      priceFloorFils: 8_000, // 80 AED
      priceCeilingFils: 30_000, // 300 AED
      audience: "mixed" as const,
      category: "outdoors",
      attendees: 8,
    },
    {
      slug: `iftar-gathering-${now}`,
      titleEn: "Community Iftar gathering",
      titleAr: "إفطار جماعي",
      descriptionEn:
        "Break your fast with neighbours. A shared table, home-cooked dishes, and space for Maghrib prayer.",
      descriptionAr:
        "أفطر مع جيرانك. مائدة مشتركة، وأطباق منزلية، ومكان مخصص لصلاة المغرب.",
      startsAt: now + day * 30,
      venueName: "Al Qasr Community Hall",
      city: "Abu Dhabi",
      capacity: 60,
      minHeadcount: 20,
      totalCostFils: 300_000, // 3000 AED
      priceFloorFils: 3_000, // 30 AED
      priceCeilingFils: 15_000, // 150 AED
      audience: "family" as const,
      category: "food",
      attendees: 34,
    },
    {
      slug: `womens-padel-${now}`,
      titleEn: "Women's padel morning",
      titleAr: "صباح البادل للسيدات",
      descriptionEn:
        "Two courts booked for three hours. All levels welcome, rackets available to borrow.",
      descriptionAr:
        "ملعبان محجوزان لثلاث ساعات. جميع المستويات مرحّب بها، والمضارب متوفرة للاستعارة.",
      startsAt: now + day * 5,
      venueName: "Reform Athletica",
      city: "Dubai",
      capacity: 8,
      minHeadcount: 4,
      totalCostFils: 60_000, // 600 AED
      priceFloorFils: 5_000,
      priceCeilingFils: 20_000,
      audience: "women_only" as const,
      category: "sports",
      attendees: 7,
    },
  ];

  const created: string[] = [];

  for (const spec of specs) {
    const eventId = crypto.randomUUID();
    const { attendees: attendeeCount, ...eventFields } = spec;

    await db.insert(events).values({
      id: eventId,
      organizerId,
      ...eventFields,
      timezone: "Asia/Dubai",
      status: "published",
      createdAt: now,
      updatedAt: now,
    });

    // Attendees, each with the price they would have been quoted at join time.
    for (let i = 0; i < attendeeCount; i++) {
      const attendeeUserId = crypto.randomUUID();
      await db.insert(users).values({
        id: attendeeUserId,
        clerkUserId: `user_demo_${eventId.slice(0, 8)}_${i}`,
        email: `attendee-${eventId.slice(0, 8)}-${i}@test.local`,
        displayName: `Attendee ${i + 1}`,
        createdAt: now,
        updatedAt: now,
      });

      await db.insert(eventAttendees).values({
        id: crypto.randomUUID(),
        eventId,
        userId: attendeeUserId,
        joinPriceFils: computeSettledPrice(
          {
            totalCostFils: spec.totalCostFils,
            minHeadcount: spec.minHeadcount,
            capacity: spec.capacity,
            priceFloorFils: spec.priceFloorFils,
            priceCeilingFils: spec.priceCeilingFils,
          },
          i + 1,
        ),
        status: "joined",
        joinedAt: now - (attendeeCount - i) * 3_600_000,
      });
    }

    created.push(spec.slug);
  }

  return Response.json({ created });
}
