import { clerkMiddleware } from "@clerk/nextjs/server";
import createMiddleware from "next-intl/middleware";
import { routing } from "@/i18n/routing";

/**
 * Locale routing + authentication middleware.
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
 * COMPOSITION, NOT CHAINING. Next.js supports a single export from this file,
 * so Clerk must WRAP the i18n handler — establishing auth context before the
 * locale redirect resolves. Exporting both, or calling one after the other,
 * silently breaks one of them.
 *
 * No `auth.protect()` here by design. Per current Clerk guidance, protection
 * belongs on the page / route handler / Server Action itself, so a matcher
 * mistake can never silently expose a protected resource.
 */
const handleI18n = createMiddleware(routing);

/**
 * API routes must NOT go through the locale handler.
 *
 * next-intl prefixes any path it handles with a locale, so an unguarded
 * `handleI18n(req)` turns POST /api/webhooks/clerk into a 307 redirect to
 * /en/api/webhooks/clerk. Clerk follows the redirect, the handler never runs,
 * and webhook delivery silently fails. Verified: this exact bug appeared here
 * once the `/(api|trpc)(.*)` matcher was added for Clerk context.
 */
function isApiRoute(pathname: string) {
  return pathname.startsWith("/api/") || pathname.startsWith("/trpc/");
}

export default clerkMiddleware((auth, req) => {
  if (isApiRoute(req.nextUrl.pathname)) {
    // Clerk context is established; skip locale rewriting and let the route
    // handler run. It performs its own signature verification.
    return;
  }
  return handleI18n(req);
});

export const config = {
  matcher: [
    // Everything except Next internals and files with an extension.
    // `/_vercel` is harmless to exclude even on Cloudflare.
    "/((?!api|trpc|_next|_vercel|.*\\..*).*)",
    // API and webhook routes still need Clerk context (the webhook verifies
    // its own signature and does not require a session).
    "/(api|trpc)(.*)",
    // Clerk's auto-proxy path — must come after the API matcher.
    "/__clerk/(.*)",
  ],
};
