import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      // Mirrors the `@/*` path alias in tsconfig.json.
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    // The pricing engine is pure — no DOM, no Workers runtime, no mocks.
    environment: "node",
    include: ["src/**/*.test.ts"],
    typecheck: {
      // Enables expectTypeOf assertions, used to guard the schema ↔ engine seam.
      enabled: true,
      include: ["src/**/*.test.ts"],
      tsconfig: "./tsconfig.json",
    },
  },
});
