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

### Cloudflare Workers
- `ctx.waitUntil()` for post-response work (e.g. sending email). **Never destructure `ctx`** — it loses `this` binding and throws at runtime.
- No floating promises: every promise is awaited, returned, or passed to `waitUntil()`.
- No module-level mutable state holding request data — Workers reuse isolates across requests, so this leaks data between users.
- `crypto.randomUUID()` / `crypto.getRandomValues()` for anything security-relevant. Never `Math.random()`.
- Use bindings (`env.DB`, `env.MEDIA`), never the Cloudflare REST API from inside a Worker.
- **Never hand-write the `Env` interface.** Run `npm run cf-typegen` after every `wrangler.jsonc` change.
- Secrets go through `wrangler secret put` — never into `wrangler.jsonc` or source.

### D1
- Every column used in a `WHERE`, `ORDER BY`, or `JOIN` needs an index. Unindexed scans burn the free tier's daily row-read budget fast.
- **Joining an event must run in a transaction with a capacity re-check.** Read-then-write oversells seats under concurrency. This is the single most likely correctness bug in this codebase.
- Migrations via `drizzle-kit` + `wrangler d1 migrations apply` — never DDL on the request path.

### Money
- All amounts are stored as **integer fils** (1 AED = 100 fils). Never floats for money.
- Slice 1 has **no payments**. The pricing engine computes and displays prices; nothing charges.

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
