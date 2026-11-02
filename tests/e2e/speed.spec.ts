/**
 * @file Speed of a tap: the phone menu opens before the SPA boots, and a touched link's page data
 * is fetched before the tap lands, once.
 */
import { boot, expect, isPhone, test } from "./_fixtures";

test.describe("tap speed, no JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  // Bug: the menu needs the client bundle, so on a slow phone the first taps do nothing.
  test("phone: the menu opens and closes with no JavaScript at all", async ({ page }, testInfo) => {
    test.skip(!isPhone(testInfo.project.name), "the burger is the phone nav");
    await page.goto("/", { waitUntil: "load" });
    const menu = page.locator("#site-menu");

    await page.locator('[data-part="burger"]').tap();

    await expect(menu).toBeVisible();
    await expect(menu.locator('a[data-nav="about"]')).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(menu).toBeHidden();
  });
});

test.describe("tap speed", () => {
  // Bug: a tap opened the menu before hydration, and the island then shows it closed.
  test("phone: a menu opened before boot stays open and in step", async ({ page }, testInfo) => {
    test.skip(!isPhone(testInfo.project.name), "the burger is the phone nav");
    const held = Promise.withResolvers<void>();
    await page.route(/\/assets\/spa-.*\.js$/, async route => {
      await held.promise;
      await route.continue();
    });
    // The module script runs before DOMContentLoaded, so wait for the first paint only.
    await page.goto("/", { waitUntil: "commit" });
    const burger = page.locator('[data-part="burger"]');
    await burger.waitFor({ state: "visible" });

    await burger.tap();
    held.resolve();

    await expect(page.locator('[data-island="theme-toggle"]')).toHaveAttribute(
      "aria-label",
      /Switch to/
    );
    await expect(page.locator("#site-menu")).toBeVisible();
    await expect(burger).toHaveAttribute("aria-expanded", "true");
  });

  // Bug: a hash link in the open menu scrolls the page but leaves the menu over it.
  test("phone: a same-page link in the menu closes the menu", async ({ page }, testInfo) => {
    test.skip(!isPhone(testInfo.project.name), "the burger is the phone nav");
    await boot(page, "/");
    await page.locator('[data-part="burger"]').tap();

    await page.locator('#site-menu a[data-nav="packages"]').tap();

    await expect(page.locator("#site-menu")).toBeHidden();
    await expect(page.locator('[data-part="burger"]')).toHaveAttribute("aria-expanded", "false");
  });

  // Bug: the menu, open in the top layer, floats over the desktop header after a rotate or resize.
  test("phone: an open menu closes when the window grows to desktop", async ({
    page
  }, testInfo) => {
    test.skip(!isPhone(testInfo.project.name), "the burger is the phone nav");
    await boot(page, "/");
    await page.locator('[data-part="burger"]').tap();
    await expect(page.locator("#site-menu")).toBeVisible();

    await page.setViewportSize({ width: 1200, height: 800 });

    await expect(page.locator('[data-component="site-header"]')).not.toHaveAttribute("data-open");
    const floating = await page
      .locator("#site-menu")
      .evaluate(menu => menu.matches(":popover-open"));
    expect(floating).toBe(false);
  });

  // Bug: the next page's data is fetched only after the tap, or twice: once warm, once on tap.
  test("a link's page data is fetched before the tap, and only once", async ({ page }) => {
    const fetched: string[] = [];
    page.on("request", request => {
      if (request.url().includes("/_data/docs/web/how-it-works/")) fetched.push(request.url());
    });
    await boot(page, "/docs/web/quick-start/");
    const link = page.locator('main a[href="/docs/web/how-it-works/"]:visible').first();
    await link.scrollIntoViewIfNeeded();

    await link.dispatchEvent("touchstart");
    await expect.poll(() => fetched.length).toBe(1);
    await link.click();

    await expect(page).toHaveURL(/\/how-it-works\/$/);
    await expect(page.locator("h1")).toContainText("How");
    expect(fetched).toHaveLength(1);
  });
});
