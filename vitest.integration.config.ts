import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    // Only top-level integration suites (tests/integration.test.ts).
    // tests/unit/** is owned by vitest.config.ts, which loads
    // tests/unit/setup.ts — those tests fail without that setup file.
    include: ["tests/*.test.ts"],
    environment: "node",
    testTimeout: 60_000,
    hookTimeout: 60_000,
    sequence: { concurrent: false },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
