/**
 * @file ⌘K search palette: opens from the header button and the shortcut; suggested items when
 * empty, no llms note in the foot; live filter with highlighted matches; arrow keys and Enter; Esc
 * and backdrop close it and return focus; the empty message.
 */
import type { Page } from "@playwright/test";
import { boot, expect, isPhone, press, test } from "./_fixtures";

const palette = (page: Page) => page.locator('[data-island="search-palette"]');
const input = (page: Page) => palette(page).getByRole("combobox", { name: "Search docs" });
const options = (page: Page) => palette(page).getByRole("option");

test("header button opens the palette with suggestions", async ({ page }, testInfo) => {
  const phone = isPhone(testInfo.project.name);
  await boot(page, "/");
  await expect(palette(page)).toBeHidden();
  const opener = page.locator('[data-component="site-header"] [data-part="search"]');
  await expect(opener).toBeVisible();
  await press(opener, phone);
  await expect(palette(page)).toBeVisible();
  await expect(input(page)).toBeFocused();
  await expect(palette(page).locator('[data-part="label"]')).toHaveText("Suggested");
  await expect(options(page)).toHaveCount(5);
  await expect(options(page).first()).toHaveAttribute("aria-selected", "true");
  await expect(palette(page).locator('[data-part="foot"]')).not.toContainText("llms");
});

test("typing filters with highlight; arrows and Enter open the pick", async ({ page }) => {
  await boot(page, "/");
  await page.locator('[data-component="site-header"] [data-part="search"]').click();
  await input(page).fill("islands");
  await expect(options(page).first()).toBeVisible();
  await expect(palette(page).locator('[data-part="label"]')).toBeHidden();
  await expect(options(page).first().locator("mark").first()).toHaveText(/islands/i);
  const count = await options(page).count();
  expect(count).toBeGreaterThan(1);
  await input(page).press("ArrowDown");
  await expect(options(page).nth(1)).toHaveAttribute("aria-selected", "true");
  await expect(input(page)).toHaveAttribute("aria-activedescendant", /.+/);
  await input(page).press("ArrowUp");
  await expect(options(page).first()).toHaveAttribute("aria-selected", "true");
  const href = (await options(page).first().getAttribute("href")) ?? "";
  await input(page).press("Enter");
  await expect(palette(page)).toBeHidden();
  await expect(page).toHaveURL(new RegExp(`${href.replaceAll("/", String.raw`\/`)}$`));
});

test("a query with no match says so", async ({ page }) => {
  await boot(page, "/docs/");
  await page.locator('[data-component="site-header"] [data-part="search"]').click();
  await expect(palette(page)).toBeVisible();
  await input(page).fill("zzqxv");
  await expect(options(page)).toHaveCount(0);
  await expect(palette(page).getByRole("status")).not.toHaveText("");
});

test("the shortcut toggles it, Esc and the backdrop close it and focus returns", async ({
  page
}, testInfo) => {
  test.skip(isPhone(testInfo.project.name), "no hardware keyboard shortcut on phones");
  await boot(page, "/docs/web/");
  await page.keyboard.press("ControlOrMeta+k");
  await expect(palette(page)).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(palette(page)).toBeHidden();

  const opener = page.locator('[data-component="site-header"] [data-part="search"]');
  await opener.click();
  await expect(palette(page)).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(opener).toBeFocused();

  await opener.click();
  await palette(page)
    .locator('[data-part="backdrop"]')
    .click({ position: { x: 8, y: 8 } });
  await expect(palette(page)).toBeHidden();

  await page.keyboard.press("ControlOrMeta+k");
  await expect(palette(page)).toBeVisible();
  await page.keyboard.press("ControlOrMeta+k");
  await expect(palette(page)).toBeHidden();
});

test("clicking a result opens it and closes the palette", async ({ page }, testInfo) => {
  const phone = isPhone(testInfo.project.name);
  await boot(page, "/");
  await press(page.locator('[data-component="site-header"] [data-part="search"]'), phone);
  await input(page).fill("routing");
  const link = options(page).first();
  const href = (await link.getAttribute("href")) ?? "";
  await press(link, phone);
  await expect(palette(page)).toBeHidden();
  await expect(page).toHaveURL(new RegExp(`${href.replaceAll("/", String.raw`\/`)}$`));
});
