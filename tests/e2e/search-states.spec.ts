/**
 * @file Goldens of the ⌘K palette's states and of the demos filter, per Chromium project. A file of
 * its own: the WebKit project matches `baseline.spec.ts` by name and has no browser installed here,
 * so these never add a golden that nothing can produce.
 */
import type { Page } from "@playwright/test";
import { boot, expect, isPhone, press, settle, test } from "./_fixtures";

const palette = (page: Page) => page.locator('[data-island="search-palette"]');

/**
 * Open the palette from the header.
 *
 * @param page - The page.
 * @param phone - Whether the project is a phone.
 */
async function openPalette(page: Page, phone: boolean) {
  await press(page.locator('[data-component="site-header"] [data-part="search"]'), phone);
  await expect(palette(page)).toBeVisible();
}

test.describe("palette goldens", () => {
  test("suggested", async ({ page }, testInfo) => {
    await boot(page, "/docs/");
    await openPalette(page, isPhone(testInfo.project.name));
    await expect(palette(page).getByRole("option")).toHaveCount(5);
    await settle(page);
    await expect(page).toHaveScreenshot("palette-suggested.png");
  });

  test("an alias, with its target marked", async ({ page }, testInfo) => {
    await boot(page, "/docs/");
    await openPalette(page, isPhone(testInfo.project.name));
    await palette(page).getByRole("combobox").fill("fx");
    await expect(palette(page).getByRole("option").first().locator("mark").first()).toBeVisible();
    await settle(page);
    await expect(page).toHaveScreenshot("palette-alias.png");
  });

  test("nothing matches", async ({ page }, testInfo) => {
    await boot(page, "/docs/");
    await openPalette(page, isPhone(testInfo.project.name));
    await expect(palette(page).getByRole("option").first()).toBeVisible();
    await palette(page).getByRole("combobox").fill("zzqxv");
    await expect(palette(page).getByRole("status")).toHaveText(/Nothing matches/);
    await settle(page);
    await expect(page).toHaveScreenshot("palette-empty.png");
  });

  test("the index did not load", async ({ page }, testInfo) => {
    await page.route("**/search/en.json", route =>
      route.fulfill({ status: 200, contentType: "application/json", body: "[]" })
    );
    await boot(page, "/docs/");
    await openPalette(page, isPhone(testInfo.project.name));
    await expect(palette(page).getByRole("status")).toHaveText(/did not load/);
    await settle(page);
    await expect(page).toHaveScreenshot("palette-failed.png");
  });
});

test("demos goldens: one chip pressed, its cards shown", async ({ page }, testInfo) => {
  await boot(page, "/demos/");
  await press(
    page.locator('[data-part="filters"] [data-filter="room"]'),
    isPhone(testInfo.project.name)
  );
  await expect(page.locator("[data-demo]").locator("visible=true")).toHaveCount(1);
  await settle(page);
  await expect(page).toHaveScreenshot("demos-filtered.png");
});
