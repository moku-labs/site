/**
 * @file Regressions found by exploratory QA (phone first): the SPA progress bar is visible while a
 * page loads, a deep link puts its heading just under the sticky header, the page under the open
 * search palette stays put, and Reset works while a plugin is still flying to the kernel.
 */
import type { Page } from "@playwright/test";
import { boot, expect, isPhone, press, test } from "./_fixtures";
import { RICH_DOC } from "./_inventory";

/** How far below the header's bottom edge an anchored heading may land, px. */
const ANCHOR_SLACK = 40;

/**
 * The bottom edge of the sticky header, px from the top of the viewport.
 *
 * @param page - The page.
 * @returns The header's bottom.
 */
function headerBottom(page: Page): Promise<number> {
  return page
    .locator('[data-component="site-header"]')
    .evaluate(header => header.getBoundingClientRect().bottom);
}

test("an SPA navigation shows a visible progress bar while the page loads", async ({
  page
}, testInfo) => {
  const phone = isPhone(testInfo.project.name);
  await boot(page, "/");
  // A slow network: the next page's data takes a while.
  await page.route("**/_data/**", async route => {
    await new Promise(resolve => setTimeout(resolve, 1500));
    await route.continue();
  });
  await press(page.locator('main a[href="/docs/"]').first(), phone);
  const bar = page.locator("[data-progress][data-active]");
  await expect(bar).toBeVisible();
  const box = await bar.boundingBox();
  expect(box?.height ?? 0).toBeGreaterThanOrEqual(2);
  expect(box?.y ?? -1).toBe(0);
  await expect(page).toHaveURL(/\/docs\/$/);
  await expect(page.locator("[data-progress][data-active]")).toHaveCount(0);
});

test("a deep link puts its heading just under the header", async ({ page }) => {
  await boot(page, `${RICH_DOC}#define-routes`);
  const heading = page.locator("[data-content] h2#define-routes");
  await expect(heading).toBeInViewport();
  const top = await heading.evaluate(element => element.getBoundingClientRect().top);
  const header = await headerBottom(page);
  expect(top).toBeGreaterThanOrEqual(header);
  expect(top - header).toBeLessThanOrEqual(ANCHOR_SLACK);
});

test("the page under the open search palette does not scroll", async ({ page }) => {
  await boot(page, RICH_DOC);
  await page.locator('[data-component="site-header"] [data-part="search"]').click();
  const palette = page.locator('[data-island="search-palette"]');
  await expect(palette).toBeVisible();
  // Wheel over the backdrop, below the panel.
  const viewport = page.viewportSize() ?? { width: 390, height: 844 };
  await page.mouse.move(viewport.width / 2, viewport.height - 40);
  await page.mouse.wheel(0, 800);
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => scrollY)).toBe(0);
  // Closed again, the page scrolls.
  await page.keyboard.press("Escape");
  await expect(palette).toBeHidden();
  await page.mouse.wheel(0, 800);
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(0);
});

test.describe("with motion", () => {
  test.use({ reducedMotion: "no-preference" });

  test("Reset while a plugin is in flight empties the kernel", async ({ page }, testInfo) => {
    const phone = isPhone(testInfo.project.name);
    await boot(page, "/");
    await page.locator('[data-part="tray"]').scrollIntoViewIfNeeded();
    await press(page.locator('[data-plug="blog"]'), phone);
    await expect(page.locator('[data-part="flyer"][data-clone]')).toBeAttached();
    await press(page.locator('[data-part="reset"]'), phone);
    await expect(page.locator('[data-part="flyer"][data-clone]')).toHaveCount(0, {
      timeout: 5000
    });
    await expect(page.locator('[data-part="log"] li')).toHaveCount(1);
    await expect(page.locator('[data-part="app-arguments"]')).toHaveText("({ plugins: [] })");
    await expect(page.locator('[data-plug="blog"]')).not.toHaveAttribute("data-state", /./);
    await expect(page.locator('[data-part="socket"][data-filled]')).toHaveCount(0);
    // The kernel takes plugins again.
    await press(page.locator('[data-plug="router"]'), phone);
    await expect(page.locator('[data-plug="router"]')).toHaveAttribute("data-state", "locked", {
      timeout: 5000
    });
  });
});
