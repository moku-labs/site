/**
 * @file Shared e2e fixtures: every test captures browser errors (`pageerror`, `console.error` and
 * `console.warn`, 4xx/5xx responses, failed requests) and fails on any; the clock is frozen; helpers
 * boot a page (fonts ready, islands mounted) and settle it for a deterministic screenshot.
 */
import type { Locator, Page } from "@playwright/test";
import { test as base, expect } from "@playwright/test";

export { expect } from "@playwright/test";

import { NOT_FOUND_PATH } from "./_inventory";

/** The frozen "now" of every page, and the date shown wherever the build stamps one. */
export const FROZEN_DATE = "2026-11-01";

type Fixtures = {
  /** Errors seen in the browser during the test; asserted empty after it. */
  errors: string[];
};

/**
 * A 4xx/5xx the test asked for: the 404 page document.
 *
 * @param url - Response URL.
 * @param status - Response status.
 * @returns Whether the response is expected.
 */
function isExpectedMiss(url: string, status: number): boolean {
  return status === 404 && new URL(url).pathname === NOT_FOUND_PATH;
}

export const test = base.extend<Fixtures>({
  errors: [
    async ({ page, javaScriptEnabled }, use) => {
      const errors: string[] = [];
      page.on("pageerror", error => errors.push(`pageerror: ${error.message}`));
      page.on("console", message => {
        const type = message.type();
        if (type === "error" || type === "warning") {
          if (/Failed to load resource.*404/.test(message.text())) return; // reported as a response
          errors.push(`console.${type}: ${message.text()}`);
        }
      });
      page.on("response", response => {
        if (response.status() >= 400 && !isExpectedMiss(response.url(), response.status())) {
          errors.push(`HTTP ${response.status()} ${response.url()}`);
        }
      });
      page.on("requestfailed", request => {
        const failure = request.failure()?.errorText ?? "";
        // Aborted by a navigation or a cancelled prefetch: not a failure of the app.
        if (/ERR_ABORTED|cancelled|NS_BINDING_ABORTED|Load request cancelled/i.test(failure))
          return;
        // With JavaScript off the browser refuses the modulepreload links: expected, not a bug.
        if (!javaScriptEnabled && failure === "csp" && request.url().endsWith(".js")) return;
        errors.push(`requestfailed: ${request.url()} ${failure}`);
      });
      await page.clock.setFixedTime(new Date(`${FROZEN_DATE}T10:00:00Z`));
      await use(errors);
      expect(errors, "browser errors during the test").toEqual([]);
    },
    { auto: true }
  ]
});

/**
 * Open a page and wait until it is usable: loaded, fonts ready, islands mounted.
 *
 * @param page - The page.
 * @param path - URL path.
 * @param options - `static` for a page with no client bundle.
 * @param options.static - The page ships no bundle, so no island mounts.
 */
export async function boot(page: Page, path: string, options: { static?: boolean } = {}) {
  await page.goto(path, { waitUntil: "load" });
  if (!options.static) {
    // The theme toggle rewrites its label on mount: the SPA has booted.
    await expect(page.locator('[data-island="theme-toggle"]')).toHaveAttribute(
      "aria-label",
      /Switch to (light|dark) theme/
    );
  }
  await page.evaluate(() => document.fonts.ready);
}

/**
 * Make the page deterministic for a screenshot: build dates frozen, every lazy image loaded and
 * decoded, fonts ready.
 *
 * @param page - The page.
 */
export async function settle(page: Page) {
  await page.evaluate(async date => {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const text = node.nodeValue ?? "";
      if (/\b20\d\d-\d\d-\d\d\b|© 20\d\d/.test(text)) {
        node.nodeValue = text
          .replaceAll(/\b20\d\d-\d\d-\d\d\b/g, date)
          .replaceAll(/© 20\d\d/g, `© ${date.slice(0, 4)}`);
      }
    }
    const images = [...document.images];
    for (const image of images) image.loading = "eager";
    await Promise.all(
      images.map(image =>
        image.complete
          ? image.decode().catch(() => undefined)
          : new Promise(resolve => {
              image.addEventListener("load", resolve, { once: true });
              image.addEventListener("error", resolve, { once: true });
            })
      )
    );
    await document.fonts.ready;
  }, FROZEN_DATE);
}

/**
 * Whether the test runs on a phone project.
 *
 * @param projectName - `testInfo.project.name`.
 * @returns True for the mobile projects.
 */
export function isPhone(projectName: string): boolean {
  return projectName.endsWith("-mobile");
}

/**
 * Press a control the way the device does: a tap on a phone, a click on desktop.
 *
 * @param locator - The control.
 * @param phone - Whether the project is a phone.
 */
export async function press(locator: Locator, phone: boolean) {
  await (phone ? locator.tap() : locator.click());
}

/**
 * Point at a control the way the device does: a tap on a phone, a hover on desktop.
 *
 * @param locator - The control.
 * @param phone - Whether the project is a phone.
 */
export async function point(locator: Locator, phone: boolean) {
  await (phone ? locator.tap() : locator.hover());
}

/**
 * Fetch a URL from the served build and return its status and body.
 *
 * @param request - Playwright's request context.
 * @param request.get - Its GET method.
 * @param url - URL path.
 * @returns The status and the body text.
 */
export async function fetchText(
  request: { get: (url: string) => Promise<{ status: () => number; text: () => Promise<string> }> },
  url: string
): Promise<{ status: number; text: string }> {
  const response = await request.get(url);
  return { status: response.status(), text: await response.text() };
}

/**
 * Scroll an element into view and wait until the page stops scrolling. The pyramid puts its tip
 * away on scroll (by design), so a gesture must not land while a scroll is still running.
 *
 * @param page - The page.
 * @param locator - The element.
 */
export async function scrollTo(page: Page, locator: Locator) {
  await locator.scrollIntoViewIfNeeded();
  await page.evaluate(
    () =>
      new Promise<void>(resolve => {
        let last = scrollY;
        let still = 0;
        const tick = () => {
          still = scrollY === last ? still + 1 : 0;
          last = scrollY;
          if (still >= 5) resolve();
          else requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      })
  );
}

/**
 * Wait until a copy button has flashed "Copied", then return the clipboard text.
 *
 * @param page - The page.
 * @param button - The copy button.
 * @returns The clipboard contents.
 */
export async function clipboardAfterCopy(page: Page, button: Locator): Promise<string> {
  await expect(button).toHaveText("Copied");
  return page.evaluate(() => navigator.clipboard.readText());
}
