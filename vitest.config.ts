import { defineConfig } from "vitest/config";

// The first Shiki render of a file takes 6-8 s on a CI runner with coverage on.
const SHIKI_WARMUP_TIMEOUT = 30_000;

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "unit",
          testTimeout: SHIKI_WARMUP_TIMEOUT,
          include: ["tests/unit/**/*.test.ts", "src/plugins/**/__tests__/unit/**/*.test.ts"]
        }
      },
      {
        test: {
          name: "integration",
          testTimeout: SHIKI_WARMUP_TIMEOUT,
          include: [
            "tests/integration/**/*.test.ts",
            "src/plugins/**/__tests__/integration/**/*.test.ts"
          ]
        }
      }
    ],
    coverage: {
      provider: "istanbul",
      include: ["src/lib/**/*.ts", "src/i18n/**/*.ts", "src/plugins/**/*.ts"],
      exclude: ["src/**/types.ts", "src/**/types/**", "src/**/__tests__/**"],
      reporter: ["text", "lcov"],
      thresholds: { lines: 90, functions: 90, branches: 90, statements: 90 }
    }
  }
});
