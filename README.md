# WanasaBookMe

Bilingual (Arabic/English) event platform for the UAE and wider GCC. Organizers host
events with **cost-split pricing** — the per-person price is derived from a total cost
divided among attendees, so it falls as more people join.

Built on Next.js 16 (App Router) deployed to Cloudflare Workers via OpenNext.

## Status

**Slice 1 — Foundation + Events Core.** In progress.

- [x] Phase 1 — Scaffold, Cloudflare resources, deployed
- [ ] Phase 2 — i18n + RTL shell
- [ ] Phase 3 — Clerk auth + user sync
- [ ] Phase 4 — Schema + pricing engine
- [ ] Phase 5 — Event create/browse/join
- [ ] Phase 6 — SEO
- [ ] Phase 7 — Consent + legal

No payments in Slice 1. The pricing engine is real and displays live prices, but
nothing is charged. Stripe arrives in Slice 2.

## Setup

```bash
npm install
npx wrangler login
npm run cf-typegen
npm run dev
```

### Cloudflare resources

Already provisioned on the account; IDs live in `wrangler.jsonc`.

| Binding | Resource | Name |
|---|---|---|
| `DB` | D1 (WEUR) | `wanasa-db` |
| `MEDIA` | R2 | `wanasa-media` |
| `CACHE` | KV | `CACHE` |

To recreate from scratch:

```bash
npx wrangler d1 create wanasa-db
npx wrangler r2 bucket create wanasa-media
npx wrangler kv namespace create CACHE
# paste the returned IDs into wrangler.jsonc, then:
npm run cf-typegen
```

### Secrets

Never commit these. Set per environment:

```bash
npx wrangler secret put CLERK_SECRET_KEY
npx wrangler secret put CLERK_WEBHOOK_SIGNING_SECRET
npx wrangler secret put RESEND_API_KEY
```

For local dev, put the same keys in `.dev.vars` (gitignored).

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Next dev server — fast, but **not** the Workers runtime |
| `npm run preview` | Build + run in `workerd` — matches production |
| `npm run deploy` | Build + deploy to Cloudflare |
| `npm run cf-typegen` | Regenerate `cloudflare-env.d.ts` after binding changes |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint, including the RTL guard |

`dev` and `preview` are different runtimes. **Verify in `preview` before claiming done.**

## Deployment

https://wanasabookme.omar1super.workers.dev

## Contributing notes

See [AGENTS.md](AGENTS.md) for the rules that matter — RTL discipline, Workers
constraints, D1 indexing and transaction requirements, and money handling.
