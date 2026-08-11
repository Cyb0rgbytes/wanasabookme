import createMiddleware from "next-intl/middleware";
import { routing } from "@/i18n/routing";

/**
 * Locale routing middleware.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * DO NOT rename this file to `proxy.ts`.
 *
 * Next.js 16 deprecates `middleware` in favour of `proxy` and emits a build
 * warning saying so. Ignore that warning. `proxy` runs ONLY on the Node.js
 * runtime and that runtime is not configurable, so Cloudflare Workers cannot
 * run it — `opennextjs-cloudflare build` fails with:
 *
 *   ERROR Node.js middleware is not currently supported.
 *
 * Per the Next.js 16 upgrade guide: "The edge runtime is NOT supported in
 * proxy… If you want to continue using the edge runtime, keep using
 * middleware."
 *
 * We tried the rename and reverted it. Revisit only when OpenNext supports
 * Node.js middleware, or Next makes the proxy runtime configurable.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * PHASE 3 NOTE: Clerk will be composed here, not chained. The shape becomes:
 *
 *   const handleI18n = createMiddleware(routing);
 *   export default clerkMiddleware((auth, req) => handleI18n(req));
 *
 * Do NOT export two handlers or call one after the other — Next.js supports a
 * single export from this file, and Clerk must wrap the i18n handler so auth
 * context is established before the locale redirect resolves.
 */
export default createMiddleware(routing);

export const config = {
  matcher: [
    // Run on everything except Next internals and files with an extension.
    // `/_vercel` is harmless to exclude even on Cloudflare.
    "/((?!api|trpc|_next|_vercel|.*\\..*).*)",
    // Clerk's auto-proxy path — required in Phase 3, listed now so the
    // matcher doesn't need editing when auth lands.
    "/__clerk/:path*",
  ],
};
