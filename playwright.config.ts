/**
 * @file Playwright e2e + visual suite. The webServer builds the site (the in-repo `content/docs`
 * corpus and the exact-pinned packages are the frozen fixtures) and serves `dist/` with the
 * framework's static preview on its own port, teeing the server output to `.e2e-server.log`
 * (scanned by the global teardown). Chromium runs everything on desktop (1440) and mobile
 * (390, touch); WebKit mobile runs the visual baselines and the boot guard.
 */
import { defineConfig, devices } from "@playwright/test";

const CI = Boolean(process.env.CI);
const PORT = Number(process.env.PORT ?? 4319);
const BASE_URL = `http://localhost:${PORT}`;

/** Chromium flags that keep text and colour rendering identical between runs. */
const CHROMIUM_ARGS = ["--font-render-hinting=none", "--force-color-profile=srgb"];

/** A 390-wide touch phone (iPhone 13/14 class), at CSS scale so goldens stay small. */
const PHONE = {
  ...devices["iPhone 13"],
  viewport: { width: 390, height: 844 },
  screen: { width: 390, height: 844 },
  deviceScaleFactor: 1
};

export default defineConfig({
  testDir: "tests/e2e",
  outputDir: "test-results",
  fullyParallel: true,
  forbidOnly: CI,
  retries: CI ? 1 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  globalTeardown: "./tests/e2e/global-teardown.ts",
  expect: {
    timeout: 7000,
    toHaveScreenshot: {
      animations: "disabled",
      caret: "hide",
      scale: "css",
      maxDiffPixelRatio: 0.02
    }
  },
  use: {
    baseURL: BASE_URL,
    colorScheme: "dark",
    reducedMotion: "reduce",
    locale: "en-US",
    timezoneId: "UTC",
    trace: "on-first-retry",
    video: "retain-on-failure"
  },
  projects: [
    {
      name: "chromium-desktop",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
        deviceScaleFactor: 1,
        permissions: ["clipboard-read", "clipboard-write"],
        launchOptions: { args: CHROMIUM_ARGS }
      }
    },
    {
      name: "chromium-mobile",
      use: {
        ...PHONE,
        browserName: "chromium",
        permissions: ["clipboard-read", "clipboard-write"],
        launchOptions: { args: CHROMIUM_ARGS }
      }
    },
    {
      name: "webkit-mobile",
      testMatch: /(baseline|no-js-errors)\.spec\.ts$/,
      use: { ...PHONE, browserName: "webkit" }
    }
  ],
  webServer: {
    command: `bun run build && bun scripts/preview.ts --port ${PORT} 2>&1 | tee .e2e-server.log`,
    url: BASE_URL,
    reuseExistingServer: !CI && !process.env.PW_FRESH_SERVER,
    timeout: 180_000,
    stdout: "ignore",
    stderr: "pipe"
  }
});
