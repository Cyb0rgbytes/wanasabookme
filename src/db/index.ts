import { drizzle } from "drizzle-orm/d1";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import * as schema from "./schema";

export { schema };

/**
 * Returns a Drizzle client bound to this request's D1 instance.
 *
 * Deliberately a function, not a module-level singleton. Workers reuse isolates
 * across requests, so a cached client would carry one request's binding into
 * another — a cross-request data leak, and the kind of bug that only appears
 * under real traffic.
 *
 * Async because `getCloudflareContext` must be awaited outside the request
 * scope (e.g. during static generation).
 */
export async function getDb() {
  const { env } = await getCloudflareContext({ async: true });
  return drizzle(env.DB, { schema });
}
