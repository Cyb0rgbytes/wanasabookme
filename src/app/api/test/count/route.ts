import { getDb } from "@/db";
import { countJoined } from "@/lib/join-event";
import { assertTestEndpointsEnabled } from "../guard";

/** DEV ONLY — see ../guard.ts. Reads the authoritative seat count from D1. */
export async function POST(req: Request) {
  const denied = assertTestEndpointsEnabled();
  if (denied) return denied;

  const { eventId } = (await req.json()) as { eventId: string };
  const db = await getDb();

  return Response.json({ count: await countJoined(db, eventId) });
}
