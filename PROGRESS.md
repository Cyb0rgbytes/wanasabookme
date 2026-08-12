# WanasaBookMe — Progress & Handoff

**Last updated:** 2026-08-12
**Branch:** `main` (local only — **no git remote configured, nothing pushed**)
**Live:** https://wanasabookme.omar1super.workers.dev

---

## What this project is

Bilingual (Arabic/English) event platform for the UAE/GCC. Organizers host events
with **cost-split pricing** — a total cost divided among attendees, so the
per-person price *falls* as more people join.

This repo is **Slice 1** of a much larger brief. The full idea (payments,
subscriptions, albums, social graph, Hijri/prayer times, UAE Pass, WhatsApp
Business API, corporate/MICE, PDPL compliance) is ~8 independent subsystems and
12+ months of work. It was deliberately decomposed; Slice 1 is the walking
skeleton that de-risks the two hardest-to-retrofit properties: **true RTL layout**
and **server-rendered SEO**.

Full design doc: `C:\Users\Omar\.claude\plans\i-ll-use-the-following-velvety-curry.md`

---

## Stack

| Layer | Choice | Version |
|---|---|---|
| Framework | Next.js App Router | 16.3.0 |
| Runtime | Cloudflare Workers via OpenNext | `@opennextjs/cloudflare` 1.20.2 |
| Database | Cloudflare D1 + Drizzle | drizzle-orm 0.45.2 |
| Auth | Clerk | `@clerk/nextjs` 7.7.4 |
| i18n | next-intl | 4.13.6 |
| Styling | Tailwind CSS | v4 |
| Tests | Vitest | 4.1.10 |
| Email | Resend | *not yet wired* |

**Cloudflare resources** (bindings in `wrangler.jsonc`):

| Binding | Resource | Name / ID |
|---|---|---|
| `DB` | D1 (WEUR) | `wanasa-db` / `78dad2be-de4b-4d9e-94fd-824d9940a168` |
| `MEDIA` | R2 | `wanasa-media` |
| `CACHE` | KV | `d2c53781517a4950b0b6ffe6fedc766a` |

---

## Progress

| Phase | Status | Commit |
|---|---|---|
| 0 — Clear Expo artifacts | ✅ Done | — |
| 1 — Scaffold + deploy | ✅ Done | `6a65520` |
| 2 — i18n + RTL shell | ✅ Done, browser-verified | `c6f9d2a` |
| 3 — Clerk auth + webhook sync | ✅ Done, verified both runtimes | `aab28ba` |
| 4 — Schema + pricing engine | ✅ Done, 50 tests | `9cfe332` |
| 5a — Atomic join + race proof | ✅ Done, stress-verified | `0b32d88` |
| **5b — Event UI** | 🔶 **Written, NOT verified** | **uncommitted** |
| 6 — SEO | ⬜ Not started | — |
| 7 — Consent + legal | ⬜ Not started | — |

---

## ⚠️ Uncommitted work — where we stopped

Phase 5b UI is written but **stopped mid-verification**. Typecheck passed; lint
had not finished running when work paused. Nothing has been browser-tested.

```
 M messages/ar.json                     # ~60 new keys, ICU plurals
 M messages/en.json
 M src/components/site-header.tsx       # added "Create event" nav link
?? src/app/[locale]/events/             # browse, detail, create, actions
?? src/components/audience-badge.tsx
?? src/components/event-card.tsx
?? src/components/price-display.tsx
?? src/lib/event-queries.ts
?? src/lib/format.ts
```

### Resume here

```bash
cd m:/AI_Projects/WanasaBookMe
npm run lint          # ← FIRST: was interrupted; expect RTL-guard findings
npm run typecheck     # was passing
npm test              # 47 passing
npm run dev           # then browser-test the flow
```

Then work the Phase 5 gate: **create → browse → join, in both locales**, verified
in `next dev` *and* `npm run preview` (workerd). Commit only after that passes.

---

## Verified facts worth not re-learning

These each cost real debugging time. They are also recorded in `AGENTS.md`.

### 1. Do NOT rename `middleware.ts` → `proxy.ts`

Next 16 deprecates `middleware` and prints a build warning recommending the
codemod. **Ignore it.** `proxy` runs only on the Node.js runtime, which is not
configurable, and Workers cannot execute it:

```
ERROR Node.js middleware is not currently supported.
```

The rename was attempted and reverted. Per the Next 16 upgrade guide: *"If you
want to continue using the edge runtime, keep using middleware."*

### 2. Local secrets need TWO files

| File | Read by | Consumer |
|---|---|---|
| `.dev.vars` | Workers runtime | `wrangler dev`, `npm run preview` |
| `.env.local` | Next.js → `process.env` | `npm run dev`, `@clerk/backend` |

Both gitignored, contents identical. With only `.dev.vars`, Clerk silently enters
**keyless mode** and webhook verification fails with *"Missing webhook signing
secret"* — while the dev server still prints *"Using secrets defined in
.dev.vars"*. Production reads neither; use `wrangler secret put`.

### 3. API routes must bypass the i18n middleware

next-intl prefixes every path it handles. `POST /api/webhooks/clerk` was
answering `307 → /en/api/webhooks/clerk`. Clerk follows redirects, so **delivery
would have looked successful in the dashboard while no row was ever written.**
Guarded with an explicit `isApiRoute()` check in `src/middleware.ts`.

### 4. D1 has no interactive transactions

Each statement is a separate Durable Object round-trip, so `BEGIN`…`COMMIT`
spanning a read and a write does not exist. The plan's "wrap the join in a
transaction" is **not implementable**. The capacity guard is one atomic
statement instead:

```sql
INSERT INTO event_attendees (...)
SELECT ... WHERE (SELECT COUNT(*) ...) < capacity
```

The loser writes zero rows; `meta.changes === 0` reports it. Arguably safer than
a transaction — there is no window to get wrong.

### 5. Arabic renders Latin digits (1 2 3), not ١ ٢ ٣

CLDR resolves `ar`/`ar-AE` to the `latn` numbering system, matching UAE
commercial usage for prices and dates. Verified:
`new Intl.NumberFormat('ar-AE').resolvedOptions().numberingSystem === 'latn'`.
**This is a product decision, already taken — not a bug.**

### 6. Clerk 7 renamed the auth components

`<SignedIn>` / `<SignedOut>` are gone. Use `<Show when="signed-in">`.

### 7. OpenNext peer range has a gap

`>=15.5.21 <16 || >=16.2.11` — Next 16.0–16.2.10 is **excluded**. Re-check on any
Next upgrade rather than assuming forward compatibility.

---

## The pricing model

`src/lib/pricing.ts` — **pure, imports nothing.** Testable without mocks; Slice 2's
Stripe code will wrap it rather than modify it.

```
settled     = clamp(totalCost / confirmedAttendees, floor, ceiling)
confirmable = confirmedAttendees >= minHeadcount
you pay     = min(priceWhenYouJoined, settled)
```

The join-time price is a **personal cap**, not a fixed amount — nobody pays more
than they agreed to, and everyone benefits when later joins lower the price. This
reconciles the four guards chosen during design, which conflicted as literally
stated.

Decisions the tests pin down:

- **All money is integer fils** (1 AED = 100 fils). Never floats.
- Division **rounds up** — rounding down on 1000/3 collects 999 and leaves the
  organizer a fil short on every odd split.
- Zero attendees yields the **ceiling**, not a divide-by-zero (an empty event page
  shows the worst case a visitor could pay).
- Quotes use the **post-join** price (`attendees + 1`) so the number doesn't drop
  the instant someone clicks — that reads as bait-and-switch even when it favours
  them.
- Price is **monotonic**: never rises as attendance grows (asserted).

---

## Capacity race — proven closed

Verified against a real D1 instance (mocks cannot exhibit a race):

| Scenario | Result |
|---|---|
| 12 racers → 3 seats | 3 winners, 9 `sold_out`, 3 DB rows |
| 20 racers → 1 seat (×3 runs) | exactly 1 winner each time |
| 20 → 2 seats | 2 winners |
| 30 → 5 seats | 5 winners |
| 25 → 7 seats | 7 winners |
| Winner re-joins | `already_joined`, count unchanged |
| Loser retries | `sold_out`, no stray seat |

Single-seat ran three times deliberately — a race that passes once may only have
been lucky.

```bash
npx wrangler dev --port 3600        # terminal 1
node scripts/test-join-race.mjs     # terminal 2
```

`/api/test/*` endpoints create users with no auth, so they sit behind a
**fail-closed** guard (`src/app/api/test/guard.ts`): anything other than an
explicit development `NODE_ENV` returns **404** — not 403, since a 403 confirms
the route exists. Verified 404 in the built Worker.

---

## Non-negotiable rules

### RTL — Arabic is a first-class language

- **Never** `ml-*`, `mr-*`, `pl-*`, `pr-*`, `left-*`, `right-*`, `text-left`,
  `text-right`, `border-l-*`, `border-r-*`.
- **Always** `ms-*`, `me-*`, `ps-*`, `pe-*`, `start-*`, `end-*`, `text-start`,
  `text-end`, `border-s-*`, `border-e-*`.
- Enforced by a **custom ESLint rule**
  (`eslint-rules/no-physical-direction-classes.mjs`). Do not disable it. It was
  tested against a probe file: caught 6/6 violations including inside template
  literals and behind `sm:` variants, with zero false positives.
- Arabic copy is written as real Arabic, never machine-translated filler.
- Arabic gets `line-height: 1.8` — Arabic ascenders/descenders read cramped at
  Latin leading.
- Icon mirroring is **opt-in** via `[dir="rtl"] [data-flip-rtl]`, never a blanket
  SVG flip (which would mirror logos too).
- **Arabic has six plural forms** (`one/two/few/many/other/=0`). ICU
  MessageFormat handles it only if every branch is written; `messages/ar.json`
  does this for `spotsLeft` and `needsMore`.

### Cloudflare Workers

- `ctx.waitUntil()` for post-response work. **Never destructure `ctx`** — it
  loses `this` binding and throws at runtime.
- No floating promises; no module-level mutable request state (isolates are
  reused across requests → cross-request leaks).
- `crypto.randomUUID()`, never `Math.random()`, for anything security-relevant.
- Bindings, never the Cloudflare REST API from inside a Worker.
- **Never hand-write the `Env` interface** — `npm run cf-typegen` after every
  `wrangler.jsonc` change.

### D1

- Every column in a `WHERE` / `ORDER BY` / `JOIN` needs an index — unindexed
  scans burn the free tier's daily row-read budget.
- Migrations only; never DDL on a request path.

### `npm run dev` ≠ `npm run preview`

Different runtimes. **A feature is not verified until it passes `preview`.** This
already caught one bug that `dev` could not (`proxy.ts`).

---

## Commands

```bash
npm run dev            # Next dev server (fast, NOT the Workers runtime)
npm run preview        # build + run in workerd — matches production
npm run deploy         # build + deploy to Cloudflare
npm run typecheck      # tsc --noEmit
npm run lint           # eslint incl. RTL guard
npm test               # unit tests (~0.5s)
npm run test:types     # + type assertions (~16s)
npm run db:generate    # new migration from schema
npm run db:migrate:local
npm run db:migrate:remote
npm run cf-typegen     # regenerate cloudflare-env.d.ts
```

Wrangler is a **local** dependency — always `npx wrangler`, never a global install.

---

## ⚠️ Outstanding — needs the human

### 1. Remote D1 has NO TABLES (blocking for deploy)

`wrangler d1 migrations apply --remote` failed with `code: 7403 — The given
account is not valid or is not authorized to access this service`. The OAuth
token can *create* D1 databases but cannot *query* them remotely.

```bash
npx wrangler login          # refresh token scopes
npm run db:migrate:remote   # then this
```

Local D1 is fully migrated (`users`, `events`, `event_attendees`).

### 2. Real signup never tested

The Clerk webhook was verified with correctly-signed synthetic events — same code
path — but no one has clicked through Clerk's UI with a real email. Local
webhooks also need a tunnel (ngrok) to reach the dev machine; absent that, test
after deploying.

### 3. Production Clerk webhook endpoint not registered

Clerk Dashboard → Webhooks → Add Endpoint:
`https://wanasabookme.omar1super.workers.dev/api/webhooks/clerk`
Subscribe to `user.created`, `user.updated`, `user.deleted`. Production gets its
own signing secret via `wrangler secret put CLERK_WEBHOOK_SIGNING_SECRET`.

### 4. Rotate keys before production

Clerk and Resend keys passed through an AI session. They are `pk_test`/`sk_test`
so risk is low, but rotate both before going live.

### 5. No git remote

Nothing is pushed anywhere. Creating a GitHub repo (and Workers Builds CI/CD) is
outward-facing and was deliberately left for explicit approval.

### 6. Arabic needs a native review

The Arabic copy was written as real Arabic, not machine-translated — but it has
not been reviewed by a native speaker. Worth doing before launch; the brief
flagged local credibility as table stakes.

---

## Next steps

1. **Finish Phase 5b** — run lint, fix findings, browser-test create → browse →
   join in both locales, verify in `preview`, commit.
2. **Phase 6 (SEO)** — `generateMetadata` per event, OG images via `next/og`,
   `hreflang` alternates, `Event` JSON-LD, `sitemap.ts`, `robots.ts`.
   Gate: pasting an event URL into WhatsApp renders a rich preview card.
3. **Phase 7 (Legal)** — cookie consent (no non-essential scripts before
   consent), Privacy Policy + T&Cs in AR/EN referencing **UAE PDPL**.
   ⚠️ Generate as **drafts requiring review by a UAE-qualified lawyer** — not as
   finished legal text.

### After Slice 1

Slice 2 (payments — Stripe authorize-now/capture-at-cutoff, subscriptions
$19/$29 monthly, regional rails like Telr/PayTabs, Apple Pay), then albums, then
social + WhatsApp Business API, then the regional layer (prayer times, Ramadan
templates, multi-currency), then UAE Pass + corporate/MICE.

Each gets its own spec → plan → build cycle.
