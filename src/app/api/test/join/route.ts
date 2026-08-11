import { getDb } from "@/db";
import { joinEvent } from "@/lib/join-event";
import { assertTestEndpointsEnabled } from "../guard";

/** DEV ONLY — see ../guard.ts. Drives joinEvent without Clerk auth. */
export async function POST(req: Request) {
  const denied = assertTestEndpointsEnabled();
  if (denied) return denied;

  const { eventId, userId } = (await req.json()) as {
    eventId: string;
    userId: string;
  };

  const db = await getDb();
  const result = await joinEvent(db, { eventId, userId });

  return Response.json(result);
}
