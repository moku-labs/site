/**
 * @file ⌘K search palette: opens from the header button and the shortcut; suggested items when
 * empty, no llms note in the foot; live filter with highlighted matches; arrow keys and Enter; Esc
 * and backdrop close it and return focus; the empty message; the alias, the hover load and a hung
 * load that ends in the failed status and retries on the next open.
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
  // Bug: the foot holds only keyboard hints, so a touch screen shows an empty strip under the results.
  if (phone) await expect(palette(page).locator('[data-part="foot"]')).toBeHidden();
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

test("the alias fx lists the effects plugin first with Effects highlighted", async ({ page }) => {
  await boot(page, "/");
  await page.locator('[data-component="site-header"] [data-part="search"]').click();
  await input(page).fill("fx");
  await expect(options(page).first()).toHaveAttribute("href", "/docs/game/plugins/effects/");
  await expect(options(page).first().locator("mark").first()).toHaveText(/Effects/i);
});

// Bug: the paint waits for the next frame, so Enter right after a keystroke opens the old pick.
test("Enter in the same frame as the last keystroke opens the new first result", async ({
  page
}) => {
  await boot(page, "/");
  await page.locator('[data-component="site-header"] [data-part="search"]').click();
  await expect(options(page).first()).toBeVisible();
  await input(page).evaluate((element: HTMLInputElement) => {
    element.value = "fx";
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
  });
  await expect(palette(page)).toBeHidden();
  await expect(page).toHaveURL(/\/docs\/game\/plugins\/effects\/$/);
});

// Bug: hover starts a load and the open starts another one, so the large file comes twice; or
// hover does not load at all and the first results wait for the network.
test("hovering the button loads the index, and opening fetches it no second time", async ({
  page
}, testInfo) => {
  test.skip(isPhone(testInfo.project.name), "no hover on phones");
  let fetched = 0;
  page.on("request", request => {
    if (request.url().endsWith("/search/en.json")) fetched += 1;
  });
  await boot(page, "/");
  const opener = page.locator('[data-component="site-header"] [data-part="search"]');
  await opener.hover();
  await expect.poll(() => fetched).toBe(1);
  await opener.click();
  await input(page).fill("fx");
  await expect(options(page).first()).toBeVisible();
  expect(fetched).toBe(1);
});

// Bug: a hung fetch shows "Loading the index…" for ever, or the failure sticks and no retry runs.
test("a hung load ends in the failed status, and the next open retries", async ({
  page
}, testInfo) => {
  const phone = isPhone(testInfo.project.name);
  await page.route("**/search/en.json", () => new Promise(() => {}));
  await boot(page, "/");
  const opener = page.locator('[data-component="site-header"] [data-part="search"]');
  await press(opener, phone);
  await expect(palette(page).getByRole("status")).toHaveText(/did not load/, { timeout: 8500 });

  await page.unroute("**/search/en.json");
  await page.keyboard.press("Escape");
  await expect(palette(page)).toBeHidden();
  await press(opener, phone);
  await expect(options(page).first()).toBeVisible();
  await expect(palette(page).locator('[data-part="status"]')).toHaveText("");
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
  // The results paint on the next frame: read the href of the new row, not of the suggestion.
  await expect(link.locator("mark").first()).toHaveText(/routing/i);
  const href = (await link.getAttribute("href")) ?? "";
  await press(link, phone);
  await expect(palette(page)).toBeHidden();
  await expect(page).toHaveURL(new RegExp(`${href.replaceAll("/", String.raw`\/`)}$`));
});
