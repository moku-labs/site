/**
 * @file Speed of a tap: the phone menu opens before the SPA boots, and a touched link's page data
 * is fetched before the tap lands, once.
 */
import { boot, expect, isPhone, test } from "./_fixtures";

test.describe("tap speed, no JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  // Bug: the menu needs the client bundle, so on a slow phone the first taps do nothing.
  test("phone: the burger opens and a second tap closes the menu, with no JavaScript", async ({
    page
  }, testInfo) => {
    test.skip(!isPhone(testInfo.project.name), "the burger is the phone nav");
    await page.goto("/", { waitUntil: "load" });
    const menu = page.locator("#site-menu");

    await page.locator('[data-part="burger"]').tap();

    await expect(menu).toBeVisible();
    await expect(menu.locator('a[data-nav="about"]')).toBeVisible();
    await page.locator('[data-part="burger"]').tap();
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

  // Bug: the data of every page is not loaded once up front, so a tap waits for the network, or
  // the start page and each next page are fetched again one by one.
  test("all page data loads once after boot, and navigation fetches no page data", async ({
    page
  }) => {
    const bundle: string[] = [];
    const pages: string[] = [];
    page.on("request", request => {
      const url = new URL(request.url());
      if (url.pathname === "/_data/_all.json") bundle.push(url.pathname);
      else if (url.pathname.startsWith("/_data/")) pages.push(url.pathname);
    });
    await boot(page, "/docs/web/quick-start/");
    await expect.poll(() => bundle.length).toBe(1);

    await page.locator('main a[href="/docs/web/how-it-works/"]:visible').first().click();
    await expect(page.locator("h1")).toContainText("How");
    await page.goBack();
    await expect(page.locator("h1")).toContainText("Quick start");

    expect(bundle).toHaveLength(1);
    expect(pages).toEqual([]);
  });

  // Bug: an auto popover light-dismisses on the burger's pointerdown and the click reopens it, so
  // a second tap never closes the menu (iPhone).
  test("phone: burger toggles; a tap outside and Esc close the menu", async ({
    page
  }, testInfo) => {
    test.skip(!isPhone(testInfo.project.name), "the burger is the phone nav");
    await boot(page, "/");
    const burger = page.locator('[data-part="burger"]');
    const menu = page.locator("#site-menu");

    for (let round = 0; round < 3; round++) {
      await burger.tap();
      await expect(menu).toBeVisible();
      await burger.tap();
      await expect(menu).toBeHidden();
    }
    await burger.tap();
    // A tap low on the page, below the open menu: outside the header.
    const viewport = page.viewportSize() ?? { width: 390, height: 844 };
    await page.touchscreen.tap(viewport.width / 2, viewport.height - 40);
    await expect(menu).toBeHidden();
    await burger.tap();
    await page.keyboard.press("Escape");
    await expect(menu).toBeHidden();
    await expect(burger).toHaveAttribute("aria-expanded", "false");

    // After an SPA navigation the island mounts again: its listeners must still work.
    await burger.tap();
    await menu.locator('a[data-nav="about"]').tap();
    await expect(page).toHaveURL(/\/about\/$/);
    await burger.tap();
    await expect(menu).toBeVisible();
    await burger.tap();
    await expect(menu).toBeHidden();
    await burger.tap();
    await page.touchscreen.tap(viewport.width / 2, viewport.height - 40);
    await expect(menu).toBeHidden();
  });

  // Bug: a tip target is renamed and loses the rule, so a long press selects the page's text again.
  // A selector guard: Chromium cannot simulate the iOS long-press selection itself.
  test("press-and-hold targets select no text", async ({ page }) => {
    await boot(page, "/");
    const targets = [
      '[data-island="kernel-world"] [data-part="world"]',
      '[data-island="kernel-world"] [data-plug]',
      '[data-island="pyramid"] svg',
      '[data-island="layers-stack"] [data-layer]'
    ];

    for (const selector of targets) {
      const style = await page
        .locator(selector)
        .first()
        .evaluate(element => getComputedStyle(element).userSelect);
      expect(style, selector).toBe("none");
    }
  });

  // Bug: Preact sets `src` before `loading`, so an SPA swap downloads every lazy icon of a closed
  // package list.
  test("a docs navigation loads no icons of a closed package list", async ({ page }) => {
    const icons: string[] = [];
    page.on("request", request => {
      if (request.url().includes("/art/icon-")) icons.push(request.url());
    });
    await boot(page, "/docs/web/quick-start/");
    const loadedOnBoot = icons.length;

    await page.locator('main a[href="/docs/web/how-it-works/"]:visible').first().click();
    await expect(page).toHaveURL(/\/how-it-works\/$/);
    await expect(page.locator("h1")).toContainText("How");
    await page.waitForLoadState("networkidle");

    // The closed list is on the new page, so the count below is not trivially equal.
    const listed = page.locator('[data-part="switcher"] li img[data-component="package-icon"]');
    expect(await listed.count()).toBeGreaterThan(5);

    expect(icons.length).toBe(loadedOnBoot);
  });
});
