# WanasaBookMe — Progress & Handoff

**Last updated:** 2026-08-12
**Repo:** https://github.com/Cyb0rgbytes/wanasabookme (`main`, pushed)
**Live:** https://wanasabookme.omar1super.workers.dev

---

## What this project is

Bilingual (Arabic/English) event platform for the UAE/GCC. Organizers host events
with **cost-split pricing** — a total cost divided among attendees, so the
per-person price *falls* as more people join.

This repo is **Slice 1** of a much larger brief. The full idea (payments,
subscriptions, albums, social graph, prayer times, UAE Pass, WhatsApp Business
API, corporate/MICE) is ~8 independent subsystems and 12+ months of work. It was
deliberately decomposed; Slice 1 is the walking skeleton that de-risks the two
hardest-to-retrofit properties: **true RTL layout** and **server-rendered SEO**.

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

**Cloudflare bindings** (`wrangler.jsonc`):

| Binding | Resource | Name / ID |
|---|---|---|
| `DB` | D1 (WEUR) | `wanasa-db` / `78dad2be-de4b-4d9e-94fd-824d9940a168` |
| `MEDIA` | R2 | `wanasa-media` |
| `CACHE` | KV | `d2c53781517a4950b0b6ffe6fedc766a` |

---

## Progress

| Phase | Status |
|---|---|
| 0 — Clear Expo artifacts | ✅ Done |
| 1 — Scaffold + deploy | ✅ Done |
| 2 — i18n + RTL shell | ✅ Done, browser-verified |
| 3 — Clerk auth + webhook sync | ✅ Done, verified both runtimes |
| 4 — Schema + pricing engine | ✅ Done, 50 tests |
| 5 — Events: join logic + full UI | ✅ Done, race-proven, browser-verified |
| **6 — SEO** | ⬜ **Next** |
| 7 — Consent + legal | ⬜ Not started |

**Working tree is clean. Everything is committed and pushed.**

### What works end-to-end today

Create an event (bilingual, cost-split config, audience setting) → browse with
search and filters → open the detail page → join. In both locales, verified in
`next dev` *and* workerd.

---

## Next up: Phase 6 (SEO)

The phase the brief specifically called out — it is what makes events spread.

- `generateMetadata` per event with localized title/description
- **Open Graph tags** so WhatsApp renders a rich preview card
- `hreflang` alternates linking the en/ar pair
- Dynamic OG images via `next/og`
- `Event` JSON-LD structured data
- `sitemap.ts` + `robots.ts`

**Gate:** pasting an event URL into WhatsApp shows a preview card.

Then Phase 7: cookie consent (no non-essential scripts before consent) and
Privacy Policy + T&Cs in AR/EN referencing **UAE PDPL** — generated as **drafts
requiring review by a UAE-qualified lawyer**, not as finished legal text.

---

## ⚠️ Outstanding — needs you

### 1. Remote D1 has NO TABLES (blocks deploy)

`wrangler d1 migrations apply --remote` failed with `code: 7403` — the OAuth
token can *create* D1 databases but cannot *query* them remotely.

```bash
npx wrangler login          # refresh token scopes
npm run db:migrate:remote
```

Local D1 is fully migrated (`users`, `events`, `event_attendees`).

### 2. Overly broad permissions in `.claude/settings.json`

A background security review flagged three **semantic escape** entries — patterns
ending `' *` that pre-approve arbitrary commands:

- `Bash(node -e ' *)` — any Node code
- `Bash(FILTER_BRANCH_SQUELCH_WARNING=1 git filter-branch -f --tree-filter ' *)`
- `Bash(git commit -q -m 'Record tool permissions in .claude/settings.json *)`

Auto-recorded by Claude Code during this session. Consider deleting those lines
so the commands prompt again. No secrets involved.

### 3. Real signup never tested

The Clerk webhook was verified with correctly-signed synthetic events — same code
path — but nobody has clicked through Clerk's UI with a real email. Local
webhooks also need a tunnel (ngrok) to reach the dev machine; otherwise test
after deploying.

### 4. Production Clerk webhook not registered

Clerk Dashboard → Webhooks → Add Endpoint:
`https://wanasabookme.omar1super.workers.dev/api/webhooks/clerk`
Subscribe to `user.created`, `user.updated`, `user.deleted`. Production needs its
own signing secret via `wrangler secret put CLERK_WEBHOOK_SIGNING_SECRET`.

### 5. Rotate keys before production

Clerk and Resend keys passed through an AI session. They are `pk_test`/`sk_test`
so risk is low, but rotate both before going live.

### 6. Arabic needs a native review

Written as real Arabic, not machine-translated — but unreviewed by a native
speaker. The brief flagged local credibility as table stakes.

### 7. Dependabot alert — assessed, do NOT "fix"

GitHub reports 1 moderate vulnerability: `esbuild <=0.24.2`
(GHSA-67mh-4wv8-2f99), reached via `drizzle-kit → @esbuild-kit/esm-loader →
esbuild`.

**Not exploitable here.** The advisory concerns esbuild's *dev server* accepting
cross-origin requests. `drizzle-kit` only invokes esbuild to transpile
`drizzle.config.ts` when generating migrations — no server is ever started, and
it is a devDependency that never ships.

**Do not run `npm audit fix --force`.** It downgrades `drizzle-kit` 0.31.10 →
0.18.1, thirteen minor versions back, which breaks D1 support entirely.
`@esbuild-kit/*` is deprecated and merged into `tsx`; the correct fix is an
upstream `drizzle-kit` release. Re-check periodically.

---

## Verified facts worth not re-learning

Each of these cost real debugging time. Also recorded in `AGENTS.md`.

### 1. Do NOT rename `middleware.ts` → `proxy.ts`

Next 16 deprecates `middleware` and recommends a codemod. **Ignore it.** `proxy`
runs only on the Node.js runtime, which is not configurable, and Workers cannot
execute it: `opennextjs-cloudflare build` fails with *"Node.js middleware is not
currently supported."* The rename was attempted and reverted.

### 2. Local secrets need TWO files

| File | Read by |
|---|---|
| `.dev.vars` | Workers runtime (`wrangler dev`, `npm run preview`) |
| `.env.local` | Next.js → `process.env` (`npm run dev`, `@clerk/backend`) |

Both gitignored, identical contents. With only `.dev.vars`, Clerk silently enters
**keyless mode** and webhook verification fails with *"Missing webhook signing
secret"* — while the dev server still prints *"Using secrets defined in
.dev.vars"*. Production reads neither; use `wrangler secret put`.

### 3. API routes must bypass the i18n middleware

next-intl prefixes every path it handles. `POST /api/webhooks/clerk` was
answering `307 → /en/api/webhooks/clerk`. Clerk follows redirects, so **delivery
would have looked successful in the dashboard while no row was ever written.**
Guarded by an explicit `isApiRoute()` check in `src/middleware.ts`.

### 4. D1 has no interactive transactions

Each statement is a separate Durable Object round-trip, so `BEGIN`…`COMMIT`
across a read and a write does not exist. The capacity guard is one atomic
statement instead:

```sql
INSERT INTO event_attendees (...)
SELECT ... WHERE (SELECT COUNT(*) ...) < capacity
```

The loser writes zero rows; `meta.changes === 0` reports it. Safer than a
transaction — there is no window to get wrong.

### 5. Never interpolate Drizzle table objects into a correlated subquery

`${eventAttendees}` inside a `sql` template does not reliably emit a correlatable
alias — Drizzle can alias the outer table, so the correlation matches nothing and
the count is **silently 0**. This shipped briefly and rendered perfectly: zero is
a valid count, and prices simply sat at the ceiling, which is exactly how an
empty event looks. Use raw column names.
`scripts/test-event-queries.mjs` now asserts rendered counts against seed data.

### 6. `Date.now()` in a Server Component is impure

React's purity rule flags it: the value gets baked into prerendered/cached
output, so an event could stay marked "already started" after caching. Use
`src/lib/now.ts` (`server-only`, so a Client Component importing it is a build
error — client clocks are the user's and may be skewed).

### 7. Arabic renders Latin digits (1 2 3), not ١ ٢ ٣

CLDR resolves `ar`/`ar-AE` to the `latn` numbering system, matching UAE
commercial usage. **A product decision already taken — not a bug.**

### 8. Arabic has six plural forms

`one / two / few / many / other / =0`. ICU MessageFormat handles it only if every
branch is written. Verified in-browser: 1 seat → "بقي مقعد واحد" (singular),
12 → "بقي 12 مقعدًا" (many).

### 9. Clerk 7 renamed the auth components

`<SignedIn>` / `<SignedOut>` are gone. Use `<Show when="signed-in">`.

### 10. OpenNext peer range has a gap

`>=15.5.21 <16 || >=16.2.11` — Next 16.0–16.2.10 is **excluded**. Re-check on any
Next upgrade.

### 11. Secret scanners match key PREFIXES, not values

GitHub blocked the first push over `sk_test_xxxxxxxxxxxx` in
`.dev.vars.example` — literal `x` characters, no real key. History was rewritten
to use `<your Clerk secret key>` style placeholders rather than clicking
"allow this secret", which would have put a `sk_test_`-shaped string in a public
repo permanently. Safety tag `backup-before-rewrite` holds the original history.

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
than they agreed to, and everyone benefits when later joins lower the price.

- **All money is integer fils** (1 AED = 100 fils). Never floats.
- Division **rounds up** — rounding down on 1000/3 collects 999 and leaves the
  organizer a fil short on every odd split.
- Zero attendees yields the **ceiling**, not a divide-by-zero.
- Quotes use the **post-join** price (`attendees + 1`) so the number doesn't drop
  the instant someone clicks — that reads as bait-and-switch even when it
  favours them.
- Price is **monotonic**: never rises as attendance grows (asserted).

---

## Capacity race — proven closed

Verified against a real D1 instance (mocks cannot exhibit a race):

| Scenario | Result |
|---|---|
| 12 racers → 3 seats | 3 winners, 9 `sold_out`, 3 DB rows |
| 20 racers → 1 seat (×3 runs) | exactly 1 winner each time |
| 20 → 2, 30 → 5, 25 → 7 | exact every time |
| Winner re-joins / loser retries | `already_joined` / `sold_out`, count stable |

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
  (`eslint-rules/no-physical-direction-classes.mjs`). Do not disable it. It found
  **zero violations across ~800 lines of new JSX** in Phase 5 — the discipline
  holds.
- Arabic copy is real Arabic, never machine-translated filler.
- Arabic gets `line-height: 1.8` — Arabic ascenders/descenders read cramped at
  Latin leading.
- Icon mirroring is **opt-in** via `[dir="rtl"] [data-flip-rtl]`, never a blanket
  SVG flip (which would mirror logos too).

### Cloudflare Workers

- `ctx.waitUntil()` for post-response work. **Never destructure `ctx`** — it
  loses `this` binding and throws at runtime.
- No floating promises; no module-level mutable request state (isolates are
  reused → cross-request leaks).
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
already caught a bug `dev` could not (`proxy.ts`).

---

## Commands

```bash
npm run dev            # Next dev server (fast, NOT the Workers runtime)
npm run preview        # build + run in workerd — matches production
npm run deploy         # build + deploy to Cloudflare
npm run typecheck      # tsc --noEmit
npm run lint           # eslint incl. RTL guard
npm test               # unit tests (~1s, 47 tests)
npm run test:types     # + type assertions (~16s)
npm run db:generate    # new migration from schema
npm run db:migrate:local
npm run db:migrate:remote
npm run cf-typegen     # regenerate cloudflare-env.d.ts
```

Integration tests (need a dev server on the matching port):

```bash
node scripts/test-join-race.mjs       # capacity race, port 3600
node scripts/test-event-queries.mjs   # counts + prices, port 3800
```

Wrangler is a **local** dependency — always `npx wrangler`, never a global
install.

---

## After Slice 1

Slice 2 (payments — Stripe authorize-now/capture-at-cutoff, subscriptions
$19/$29 monthly, regional rails like Telr/PayTabs, Apple Pay), then albums, then
social + WhatsApp Business API, then the regional layer (prayer times, Ramadan
templates, multi-currency), then UAE Pass + corporate/MICE.

Each gets its own spec → plan → build cycle.
