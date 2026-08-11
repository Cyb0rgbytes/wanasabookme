/**
 * Integration test for the capacity race.
 *
 * The plan calls overselling "the single most likely correctness bug in the
 * slice". A unit test with a mocked DB cannot prove it is fixed — the fix
 * lives in SQL semantics, so this fires concurrent joins at a REAL D1 instance
 * through the running Worker and asserts exactly one winner per seat.
 *
 * Usage:
 *   npx wrangler dev --port 3600      (in another terminal)
 *   node scripts/test-join-race.mjs
 */

const BASE = process.env.BASE_URL ?? "http://localhost:3600";
const CONCURRENCY = 12;

let failures = 0;

function check(label, actual, expected) {
  const pass = actual === expected;
  if (!pass) failures++;
  console.log(
    `${pass ? "PASS" : "FAIL"}  ${label}\n      expected=${expected} actual=${actual}`,
  );
}

async function post(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  try {
    return { status: res.status, json: JSON.parse(text) };
  } catch {
    return { status: res.status, json: null, text: text.slice(0, 200) };
  }
}

console.log(`\n=== capacity race test against ${BASE} ===\n`);

// Seat count deliberately smaller than the number of racers.
const CAPACITY = 3;

const setup = await post("/api/test/seed-race", {
  capacity: CAPACITY,
  userCount: CONCURRENCY,
});

if (setup.status !== 200 || !setup.json?.eventId) {
  console.error("FAILED to seed:", setup.status, setup.json ?? setup.text);
  console.error("\nIs `npx wrangler dev --port 3600` running?");
  process.exit(2);
}

const { eventId, userIds } = setup.json;
console.log(`seeded event ${eventId} capacity=${CAPACITY} racers=${userIds.length}\n`);

// Fire every join at once. No await between them — that is the whole point.
const results = await Promise.all(
  userIds.map((userId) => post("/api/test/join", { eventId, userId })),
);

const winners = results.filter((r) => r.json?.ok === true);
const soldOut = results.filter((r) => r.json?.reason === "sold_out");

check("winners equals capacity", winners.length, CAPACITY);
check("losers rejected as sold_out", soldOut.length, CONCURRENCY - CAPACITY);

const verify = await post("/api/test/count", { eventId });
check("rows in DB equals capacity", verify.json?.count, CAPACITY);

// Every winner must hold a distinct seat.
const uniqueAttendees = new Set(winners.map((w) => w.json.attendeeId));
check("winners have distinct attendee ids", uniqueAttendees.size, CAPACITY);

// Re-joining a full event must fail cleanly rather than throw. Pick an actual
// winner — userIds[0] may have lost the race, in which case the correct answer
// is "sold_out", not "already_joined".
const winnerUserId = userIds[results.findIndex((r) => r.json?.ok === true)];
const rejoin = await post("/api/test/join", { eventId, userId: winnerUserId });
check(
  "a winner re-joining is reported as already_joined",
  rejoin.json?.reason,
  "already_joined",
);

// And a loser retrying still gets sold_out, not a crash or a stray seat.
const loserUserId = userIds[results.findIndex((r) => r.json?.reason === "sold_out")];
const loserRetry = await post("/api/test/join", { eventId, userId: loserUserId });
check("a loser retrying is still sold_out", loserRetry.json?.reason, "sold_out");

const finalCount = await post("/api/test/count", { eventId });
check("count unchanged after re-join attempt", finalCount.json?.count, CAPACITY);

console.log(
  `\n${failures === 0 ? "ALL PASS — no overselling" : `${failures} FAILURE(S)`}\n`,
);
process.exit(failures === 0 ? 0 : 1);
