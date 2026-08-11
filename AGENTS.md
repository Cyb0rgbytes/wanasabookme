# WanasaBookMe — Agent Instructions

Bilingual (Arabic/English) event hosting platform for the UAE/GCC market.
Users host and join events with **cost-split pricing** that scales with attendance.

## Stack — verify against docs, do not assume

| Layer | Choice | Notes |
|---|---|---|
| Framework | **Next.js 16 (App Router)** | React 19, Turbopack, Server Components |
| Hosting | **Cloudflare Workers** via `@opennextjs/cloudflare` | NOT Vercel. Deploys to a Worker. |
| Database | **Cloudflare D1** (SQLite) + Drizzle ORM | No PostGIS, no Postgres features |
| Storage | **Cloudflare R2** (`MEDIA` binding) | Event covers, album photos |
| Cache/KV | **Cloudflare KV** (`CACHE` binding) | |
| Auth | **Clerk** (`@clerk/nextjs`) | |
| Email | **Resend** | |
| i18n | **next-intl**, locales `en` + `ar`, always-prefixed | |
| Styling | **Tailwind CSS v4** | Logical properties only — see RTL rules |

**Read the real docs before writing code.** Next.js 16 and OpenNext both moved fast:
- OpenNext/Cloudflare: https://opennext.js.org/cloudflare
- Workers: https://developers.cloudflare.com/workers/
- D1: https://developers.cloudflare.com/d1/
- next-intl: https://next-intl.dev/

## Non-negotiable rules

### RTL — Arabic is a first-class language, not a translation
- **Never** use physical-direction classes: `ml-*`, `mr-*`, `pl-*`, `pr-*`, `left-*`, `right-*`, `text-left`, `text-right`, `border-l-*`, `border-r-*`.
- **Always** use logical equivalents: `ms-*`, `me-*`, `ps-*`, `pe-*`, `start-*`, `end-*`, `text-start`, `text-end`, `border-s-*`, `border-e-*`.
- ESLint enforces this. Do not disable the rule.
- Arabic copy must be written as real Arabic, never machine-translated filler.
- **Numerals stay Latin (1 2 3) in Arabic**, via plain `Intl.NumberFormat(locale)`.
  CLDR resolves `ar`/`ar-AE` to the `latn` numbering system because that is what
  UAE commerce actually uses for prices, dates, and phone numbers. Verified in
  Chrome: `new Intl.NumberFormat('ar-AE').resolvedOptions().numberingSystem === 'latn'`.
  Do not force `ar-u-nu-arab` — it is a product decision, already taken.

### Cloudflare Workers
- `ctx.waitUntil()` for post-response work (e.g. sending email). **Never destructure `ctx`** — it loses `this` binding and throws at runtime.
- No floating promises: every promise is awaited, returned, or passed to `waitUntil()`.
- No module-level mutable state holding request data — Workers reuse isolates across requests, so this leaks data between users.
- `crypto.randomUUID()` / `crypto.getRandomValues()` for anything security-relevant. Never `Math.random()`.
- Use bindings (`env.DB`, `env.MEDIA`), never the Cloudflare REST API from inside a Worker.
- **Never hand-write the `Env` interface.** Run `npm run cf-typegen` after every `wrangler.jsonc` change.
- Secrets go through `wrangler secret put` — never into `wrangler.jsonc` or source.
- **Local secrets live in TWO gitignored files with identical contents:**
  `.dev.vars` (Workers runtime) and `.env.local` (Next.js `process.env`).
  Libraries reading `process.env` — `@clerk/backend` among them — cannot see
  `.dev.vars`. Setting only `.dev.vars` puts Clerk in "keyless mode" and webhook
  verification fails with "Missing webhook signing secret", while the dev server
  still prints "Using secrets defined in .dev.vars". Keep both in sync.

### D1
- Every column used in a `WHERE`, `ORDER BY`, or `JOIN` needs an index. Unindexed scans burn the free tier's daily row-read budget fast.
- **Joining an event must run in a transaction with a capacity re-check.** Read-then-write oversells seats under concurrency. This is the single most likely correctness bug in this codebase.
- Migrations via `drizzle-kit` + `wrangler d1 migrations apply` — never DDL on the request path.

### Money
- All amounts are stored as **integer fils** (1 AED = 100 fils). Never floats for money.
- Slice 1 has **no payments**. The pricing engine computes and displays prices; nothing charges.
- **Cost-split model** (`src/lib/pricing.ts`, pure — imports nothing):
  ```
  settled     = clamp(totalCost / confirmedAttendees, floor, ceiling)
  confirmable = confirmedAttendees >= minHeadcount
  you pay     = min(priceWhenYouJoined, settled)
  ```
  The join-time price is a personal **cap**, not a fixed amount: nobody pays more
  than they agreed to, and everyone benefits when later joins lower the price.
- Division **rounds up** so the collected total always covers the organizer's cost.
- Zero attendees yields the **ceiling**, not a division by zero — an empty event
  page shows the worst case a visitor could pay.
- Quotes use the **post-join** price (`attendees + 1`); quoting the pre-join price
  would make the number drop the instant someone clicks, which reads as a
  bait-and-switch.
- Keep `pricing.ts` free of imports. It stays testable without mocks, and Slice 2's
  Stripe code wraps it rather than changing it.

## Layout

```
src/
  app/[locale]/        # localized routes; every page calls setRequestLocale()
  app/api/             # route handlers (webhooks)
  db/schema.ts         # Drizzle schema — source of truth
  lib/pricing.ts       # PURE cost-split engine, no imports, test-first
  i18n/routing.ts      # next-intl config
messages/{en,ar}.json  # translations
```

## Commands

```bash
npm run dev         # Next dev server (fast, but NOT the Workers runtime)
npm run preview     # build + run in workerd — behaviour differs from dev, test here
npm run deploy      # build + deploy to Cloudflare
npm run cf-typegen  # regenerate cloudflare-env.d.ts after binding changes
npm run typecheck   # tsc --noEmit
npm run lint        # eslint (includes the RTL guard)
```

`npm run dev` and `npm run preview` are different runtimes. **A feature is not verified until it passes `preview`.**

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
