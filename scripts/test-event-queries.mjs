/**
 * Integration test for event queries against a real D1 instance.
 *
 * Exists because of a bug that unit tests could not have caught: interpolating
 * Drizzle table objects into a `sql` template inside a correlated subquery
 * produced joinedCount = 0 for every event. The page still rendered, prices
 * simply sat at the ceiling — which is exactly how a genuinely empty event
 * looks. Only comparing against known data revealed it.
 *
 * Usage:
 *   npx next dev --port 3800        (in another terminal)
 *   node scripts/test-event-queries.mjs
 */

const BASE = process.env.BASE_URL ?? "http://localhost:3800";

let failures = 0;

function check(label, actual, expected) {
  const pass = actual === expected;
  if (!pass) failures++;
  console.log(
    `${pass ? "PASS" : "FAIL"}  ${label}\n      expected=${expected} actual=${actual}`,
  );
}

async function post(path, body = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  try {
    return { status: res.status, json: JSON.parse(text) };
  } catch {
    return { status: res.status, text: text.slice(0, 200) };
  }
}

console.log(`\n=== event query test against ${BASE} ===\n`);

const seed = await post("/api/test/seed-demo");
if (seed.status !== 200 || !seed.json?.created?.length) {
  console.error("FAILED to seed:", seed.status, seed.json ?? seed.text);
  console.error("\nIs `npx next dev --port 3800` running?");
  process.exit(2);
}

// The seeder creates a known attendee count per event; the rendered page must
// agree. A zero here means the correlated subquery has regressed.
const expected = {
  "desert-bbq": { joined: 8, capacity: 20, totalAed: 2400 },
  "iftar-gathering": { joined: 34, capacity: 60, totalAed: 3000 },
  "womens-padel": { joined: 7, capacity: 8, totalAed: 600 },
};

for (const slug of seed.json.created) {
  const prefix = slug.replace(/-\d+$/, "");
  const want = expected[prefix];
  if (!want) continue;

  const html = await fetch(`${BASE}/en/events/${slug}`).then((r) => r.text());

  // "8 of 20 joined"
  const countMatch = html.match(/(\d+)\s+of\s+(\d+)\s+joined/);
  check(
    `${prefix}: attendee count rendered`,
    countMatch ? Number(countMatch[1]) : null,
    want.joined,
  );

  // Price must reflect the split, not sit at the ceiling.
  const expectedPrice = Math.ceil((want.totalAed * 100) / (want.joined + 1)) / 100;
  const priceMatch = html.match(/AED\s*([\d,]+(?:\.\d+)?)/);
  const rendered = priceMatch ? Number(priceMatch[1].replace(/,/g, "")) : null;
  check(
    `${prefix}: price reflects the split`,
    rendered,
    Number(expectedPrice.toFixed(2)),
  );
}

console.log(
  `\n${failures === 0 ? "ALL PASS — counts and prices correct" : `${failures} FAILURE(S)`}\n`,
);
process.exit(failures === 0 ? 0 : 1);
