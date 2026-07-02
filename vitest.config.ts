import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

const root = import.meta.dirname;

export default defineConfig({
  resolve: {
    alias: {
      "@": resolve(root, "src"),
      // `server-only` throws outside a React Server bundler; stub it so route
      // modules (which transitively import it) load under the Vitest node env.
      "server-only": resolve(root, "tests/integration/stubs/server-only.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["tests/integration/**/*.test.ts"],
    // One shared SQLite file - don't run integration files in parallel.
    fileParallelism: false,
    hookTimeout: 30_000,
    env: {
      DATABASE_URL: "file:./dev.db",
      SESSION_SECRET: "vitest-integration-secret-aaaaaaaaaaaaaaaaaaaaaa",
    },
  },
});
