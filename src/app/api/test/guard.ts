/**
 * Gate for /api/test/* endpoints.
 *
 * These routes create users and events with no authentication, which is
 * exactly what a load-testing script needs and exactly what must never be
 * reachable in production. The check is fail-closed: anything other than an
 * explicit development NODE_ENV returns 404, so a misconfigured deploy hides
 * the routes rather than exposing them.
 *
 * 404 rather than 403 — a 403 confirms the endpoint exists.
 */
export function assertTestEndpointsEnabled(): Response | null {
  if (process.env.NODE_ENV !== "development") {
    return new Response("Not found", { status: 404 });
  }
  return null;
}
