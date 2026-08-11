import { defineConfig } from "drizzle-kit";

/**
 * Generates SQL migrations into drizzle/migrations, which `wrangler d1
 * migrations apply` then runs against D1.
 *
 * Never run DDL from application code — schema changes belong in migrations,
 * applied once, not on a request path.
 */
export default defineConfig({
  dialect: "sqlite",
  driver: "d1-http",
  schema: "./src/db/schema.ts",
  out: "./drizzle/migrations",
  verbose: true,
  strict: true,
});
