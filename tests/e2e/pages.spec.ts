/**
 * @file Demos filter chips (filter, empty state, show all), demo card links (Source only until a
 * demo is deployed), the About page and the 404 page.
 */
import { about, principles } from "../../src/data/about";
import { demos } from "../../src/data/demos";
import { boot, expect, isPhone, press, test } from "./_fixtures";
import { NOT_FOUND_PATH, SITE_SCREENS } from "./_inventory";

test.describe("demos", () => {
  test("chips filter the cards; an unused package shows its empty state", async ({
    page
  }, testInfo) => {
    const phone = isPhone(testInfo.project.name);
    await boot(page, "/demos/");
    const cards = page.locator("[data-demo]");
    const chip = (id: string) => page.locator(`[data-part="filters"] [data-filter="${id}"]`);
    await expect(cards).toHaveCount(demos.length);
    await expect(chip("all")).toHaveAttribute("aria-pressed", "true");
    for (const id of ["web", "game", "native"]) {
      await press(chip(id), phone);
      await expect(chip(id)).toHaveAttribute("aria-pressed", "true");
      await expect(chip("all")).toHaveAttribute("aria-pressed", "false");
      const expected = demos.filter(demo => demo.stack.includes(id)).length;
      await expect(cards.locator("visible=true")).toHaveCount(expected);
    }
    await press(chip("ai"), phone);
    await expect(cards.locator("visible=true")).toHaveCount(0);
    const empty = page.locator('[data-empty-for="ai"]');
    await expect(empty).toBeVisible();
    await expect(empty).toContainText("No demo uses @moku-labs/ai");
    await press(empty.getByRole("button", { name: "Show all six demos" }), phone);
    await expect(cards.locator("visible=true")).toHaveCount(demos.length);
    await expect(empty).toBeHidden();
    await expect(chip("all")).toHaveAttribute("aria-pressed", "true");
  });

  test("every card has a diorama, its stack, Source, and Live only when deployed", async ({
    page
  }) => {
    await boot(page, "/demos/");
    for (const demo of demos) {
      const card = page.locator(`[data-demo]#${demo.id}, [data-demo="${demo.id}"]`).first();
      await expect(card).toBeVisible();
      await expect(card).toContainText(demo.name);
      await expect(card.locator("img").first()).toHaveAttribute("alt", demo.alt ?? "");
      await expect(card.getByRole("link", { name: /Source/ })).toHaveAttribute(
        "href",
        /^https:\/\//
      );
      const links = card.locator('[data-part="links"] a');
      await expect(links).toHaveText(demo.live === undefined ? ["Source"] : ["Live", "Source"]);
    }
    await expect(page.locator('[data-part="soon"]')).toHaveCount(0);
    await expect(page.locator("main")).not.toContainText("Soon");
  });
});

test.describe("about", () => {
  test("portrait, buttons, principles, and the package row link out", async ({ page }) => {
    await boot(page, "/about/");
    await expect(page.locator("h1")).toHaveText("Alex Kucherenko");
    await expect(page.locator('[data-part="motto"]')).toHaveText(about.motto);
    await expect(page.locator('[data-part="principles"] > *')).toHaveCount(principles.length);
    await expect(page.locator('main a[href="https://github.com/moku-labs"]').first()).toBeVisible();
    await expect(page.locator('main a[href="https://alexblog.net"]').first()).toBeVisible();
    const packageLinks = page.locator('main a[href^="/docs/"]');
    expect(await packageLinks.count()).toBeGreaterThanOrEqual(12);
  });
});

test.describe("404", () => {
  test("an unknown URL gets the 404 page with links home and to the docs", async ({
    page
  }, testInfo) => {
    const phone = isPhone(testInfo.project.name);
    const response = await page.goto(NOT_FOUND_PATH);
    expect(response?.status()).toBe(404);
    await expect(page.locator("h1")).toHaveText("404");
    await expect(page.locator('main a[href="/docs/"]')).toHaveText("Open the docs");
    const home = page.locator('main a[href="/"]').first();
    await expect(home).toHaveText("Home");
    await press(home, phone);
    await expect(page).toHaveURL(/\/$/);
    await expect(page.locator("h1").first()).toHaveText(SITE_SCREENS[0]?.title ?? "");
  });
});
