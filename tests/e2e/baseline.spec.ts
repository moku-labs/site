/**
 * @file Visual goldens: every screen full page, plus the transient states (menus, palette, tips,
 * hero verdicts, empty state, light theme) in the viewport, per project. Determinism: animations
 * off, reduced motion, frozen dates, eager images, fonts ready (see `settle`).
 */
import type { Page } from "@playwright/test";
import { siteGoal } from "../../src/data/assembly";
import { boot, expect, isPhone, point, press, scrollTo, settle, test } from "./_fixtures";
import { RICH_DOC, SCREENS } from "./_inventory";

// The landing's prompts are a random pick from a pool: a seeded Math.random makes the pick, and so
// every golden, the same on each run.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    // Park-Miller: integer steps stay exact in a double.
    let seed = 20_261_103;
    Math.random = () => {
      seed = (seed * 16_807) % 2_147_483_647;
      return (seed - 1) / 2_147_483_646;
    };
  });
});

for (const screen of SCREENS) {
  test(`screen ${screen.name}`, async ({ page }) => {
    await boot(page, screen.path, { static: screen.static ?? false });
    await settle(page);
    await expect(page).toHaveScreenshot(`${screen.name}.png`, { fullPage: true });
  });
}

/**
 * Settle and take a viewport golden of a state.
 *
 * @param page - The page.
 * @param name - Golden name.
 */
async function stateShot(page: Page, name: string) {
  await settle(page);
  await expect(page).toHaveScreenshot(`state-${name}.png`);
}

test.describe("states", () => {
  test("search palette with results", async ({ page }) => {
    await boot(page, "/");
    await page.locator('[data-component="site-header"] [data-part="search"]').click();
    const palette = page.locator('[data-island="search-palette"]');
    await expect(palette).toBeVisible();
    await palette.getByRole("combobox").or(palette.locator("input")).first().fill("rout");
    await expect(palette.getByRole("option").first()).toBeVisible();
    await stateShot(page, "search-results");
  });

  test("hero after a full run", async ({ page }) => {
    await boot(page, "/");
    for (const piece of siteGoal.pieces) await page.locator(`[data-plug="${piece.id}"]`).click();
    await expect(page.locator('[data-labels] [data-callout="running"]:visible')).toBeVisible();
    // The clicks leave the page wherever they scrolled it: start the shot's scroll from the top.
    await page.evaluate(() => window.scrollTo(0, 0));
    await scrollTo(page, page.locator('[data-part="world-frame"]'));
    await stateShot(page, "hero-win");
  });

  test("pyramid tip", async ({ page }, testInfo) => {
    const phone = isPhone(testInfo.project.name);
    await boot(page, "/");
    const layout = phone ? "stacked" : "wide";
    const brick = page.locator(`svg[data-layout="${layout}"] [data-brick][data-id="trivia"]`);
    await scrollTo(page, brick);
    await point(brick, phone);
    await expect(
      page.locator('[data-component="pyramid"] [data-component="world-tip"]')
    ).toBeVisible();
    await stateShot(page, "pyramid-tip");
  });

  test("demos empty state", async ({ page }) => {
    await boot(page, "/demos/");
    await page.locator('[data-part="filters"] [data-filter="ai"]').click();
    await expect(page.locator('[data-empty-for="ai"]')).toBeVisible();
    await stateShot(page, "demos-empty");
  });

  test("home in the light theme", async ({ page }) => {
    await boot(page, "/");
    await page.locator('[data-island="theme-toggle"]').click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await stateShot(page, "home-light");
  });

  test("mobile menu open", async ({ page }, testInfo) => {
    test.skip(!isPhone(testInfo.project.name), "the burger exists on phones only");
    await boot(page, "/");
    await press(page.locator('[data-part="burger"]'), true);
    await expect(page.locator("#site-menu")).toBeVisible();
    await stateShot(page, "menu-open");
  });

  test("mobile docs pages disclosure open", async ({ page }, testInfo) => {
    test.skip(!isPhone(testInfo.project.name), "the disclosure collapses on phones only");
    await boot(page, RICH_DOC);
    await press(page.locator('[data-component="docs-sidebar"] > summary'), true);
    await expect(page.locator('[data-component="docs-sidebar"] > nav')).toBeVisible();
    await stateShot(page, "docs-nav-open");
  });
});
