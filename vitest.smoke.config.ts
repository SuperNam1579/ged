import { defineConfig } from "vitest/config";
import path from "path";

// Smoke tests that run against a real database: `npm run test:smoke`.
// Kept out of `npm test`, which must never need a database. The tests refuse
// to run against production (scripts/db/guard.ts).
export default defineConfig({
  test: {
    environment: "node",
    include: ["scripts/**/*.smoke.ts"],
    testTimeout: 120_000,
    hookTimeout: 60_000,
    fileParallelism: false,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
