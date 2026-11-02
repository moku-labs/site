/**
 * @file Site chrome: header nav (desktop links with the active mark, phone burger menu; no Docs tag
 * and no llms.txt link in the header), theme toggle (flips, persists for the visit, survives SPA
 * navigation, `?theme=`), skip link, footer (the For agents column holds the two agent files).
 */
import { boot, expect, isPhone, press, test } from "./_fixtures";

test.describe("header nav", () => {
  test("desktop: links visible, active link marked across SPA navigation", async ({
    page
  }, testInfo) => {
    test.skip(isPhone(testInfo.project.name), "desktop nav");
    await boot(page, "/");
    await expect(page.locator('[data-part="burger"]')).toBeHidden();
    const links = page.locator("#site-menu a");
    await expect(links).toHaveCount(5);
    for (const link of await links.all()) await expect(link).toBeVisible();
    await expect(page.locator('[data-component="site-header"] a[href="/llms.txt"]')).toHaveCount(0);
    await page.locator('#site-menu a[data-nav="demos"]').click();
    await expect(page).toHaveURL(/\/demos\/$/);
    await expect(page.locator('#site-menu a[data-nav="demos"]')).toHaveAttribute(
      "aria-current",
      "page"
    );
    await page.locator('#site-menu a[data-nav="docs"]').click();
    await expect(page).toHaveURL(/\/docs\/$/);
    await expect(page.locator('#site-menu a[data-nav="docs"]')).toHaveAttribute(
      "aria-current",
      "page"
    );
    await expect(page.locator('#site-menu a[data-nav="demos"]')).not.toHaveAttribute(
      "aria-current",
      /.*/
    );
    // The Docs tag next to the logo is gone: the nav link alone marks the docs.
    await expect(page.locator('[data-part="docs-tag"]')).toHaveCount(0);
    await expect(page.locator('[data-component="site-header"] a[href="/llms.txt"]')).toHaveCount(0);
    await page.locator('[data-part="logo"]').first().click();
    await expect(page).toHaveURL(/\/$/);
    await page.locator('#site-menu a[data-nav="packages"]').click();
    await expect(page.locator("#packages")).toBeInViewport();
  });

  test("phone: burger opens the menu, a link navigates and closes it, Esc closes", async ({
    page
  }, testInfo) => {
    test.skip(!isPhone(testInfo.project.name), "burger is the phone nav");
    await boot(page, "/");
    const burger = page.locator('[data-part="burger"]');
    const header = page.locator('[data-component="site-header"]');
    await expect(burger).toBeVisible();
    await expect(page.locator("#site-menu")).toBeHidden();
    await expect(burger).toHaveAttribute("aria-expanded", "false");
    await burger.tap();
    await expect(burger).toHaveAttribute("aria-expanded", "true");
    await expect(header).toHaveAttribute("data-open", "");
    await expect(page.locator('#site-menu a[data-nav="about"]')).toBeVisible();
    await page.locator('#site-menu a[data-nav="about"]').tap();
    await expect(page).toHaveURL(/\/about\/$/);
    await expect(page.locator("#site-menu")).toBeHidden();
    await expect(burger).toHaveAttribute("aria-expanded", "false");
    await burger.tap();
    await expect(page.locator("#site-menu")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.locator("#site-menu")).toBeHidden();
    await burger.tap();
    await burger.tap();
    await expect(page.locator("#site-menu")).toBeHidden();
  });

  test("skip link appears on focus and moves to the content", async ({ page }, testInfo) => {
    test.skip(isPhone(testInfo.project.name), "keyboard on desktop");
    await boot(page, "/docs/");
    await page.keyboard.press("Tab");
    const skip = page.locator('[data-component="skip-link"]');
    await expect(skip).toBeFocused();
    await expect(skip).toBeInViewport();
    await page.keyboard.press("Enter");
    await expect(page.locator("main#content")).toBeFocused();
  });
});

test.describe("theme toggle", () => {
  test("flips, persists across reload and navigation, and ?theme= forces it", async ({
    page
  }, testInfo) => {
    const phone = isPhone(testInfo.project.name);
    await boot(page, "/");
    const html = page.locator("html");
    const toggle = page.locator('[data-island="theme-toggle"]');
    await expect(html).toHaveAttribute("data-theme", "dark");
    const dark = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    await expect(toggle).toHaveAttribute("aria-pressed", "false");
    await expect(toggle).toHaveAccessibleName("Switch to light theme");
    await press(toggle, phone);
    await expect(html).toHaveAttribute("data-theme", "light");
    await expect(toggle).toHaveAttribute("aria-pressed", "true");
    await expect(toggle).toHaveAccessibleName("Switch to dark theme");
    await page.reload();
    await expect(html).toHaveAttribute("data-theme", "light");
    await expect
      .poll(() => page.evaluate(() => getComputedStyle(document.body).backgroundColor))
      .not.toBe(dark);
    await press(page.locator('main a[href="/docs/"]').first(), phone);
    await expect(page).toHaveURL(/\/docs\/$/);
    await expect(html).toHaveAttribute("data-theme", "light");
    await expect(page.locator('[data-island="theme-toggle"]')).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    await page.goto("/about/?theme=dark");
    await expect(html).toHaveAttribute("data-theme", "dark");
    await page.goto("/demos/");
    await expect(html).toHaveAttribute("data-theme", "dark");
  });

  test("the 404 page follows the chosen theme", async ({ page }) => {
    await page.goto("/?theme=light");
    await page.goto("/no-such-page/");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await expect(page.locator("h1")).toHaveText("404");
  });
});

test("footer links lead somewhere real", async ({ page, request }) => {
  await boot(page, "/");
  const footer = page.locator('[data-component="site-footer"]');
  for (const link of await footer.locator('a[href^="/"]').all()) {
    const href = (await link.getAttribute("href")) ?? "";
    const response = await request.get(href);
    expect(response.status(), href).toBe(200);
  }
  await expect(footer.locator('a[href="https://github.com/moku-labs"]')).toHaveAttribute(
    "rel",
    /noopener/
  );
  const agents = footer
    .getByRole("heading", { name: "For agents" })
    .locator("xpath=following-sibling::ul[1]");
  await expect(agents.getByRole("link")).toHaveText(["llms.txt", "llms-full.txt"]);
  await expect(agents.getByRole("link", { name: "llms.txt", exact: true })).toHaveAttribute(
    "href",
    "/llms.txt"
  );
  await expect(agents.getByRole("link", { name: "llms-full.txt" })).toHaveAttribute(
    "href",
    "/llms-full.txt"
  );
  await expect(footer.getByRole("link", { name: "Claude plugin" })).toHaveCount(0);
});
