/**
 * @file The game and editor docs (new trees) and every package home's own prompts: a page renders
 * with its sidebar listing the package's sections and pages, the current page marked, a sidebar
 * link navigating; each package home shows three or four prompts and each Copy copies its own.
 */
import type { Page } from "@playwright/test";
import { boot, clipboardAfterCopy, expect, isPhone, press, test } from "./_fixtures";
import { DOC_SCREENS, PACKAGE_IDS } from "./_inventory";

const sidebar = (page: Page) => page.locator('[data-component="docs-sidebar"]');
const sidebarNav = (page: Page) => sidebar(page).locator(":scope > nav");

/** The sidebar sections of the game and editor docs, in order. */
const SECTIONS = ["Get started", "Guides", "Plugins", "API reference"];

/** A start page and a plugin page of the game docs, and the editor's start page. */
const PAGES = ["/docs/game/quick-start/", "/docs/game/plugins/flow/", "/docs/editor/quick-start/"];

/**
 * The corpus pages of one package in one sidebar section.
 *
 * @param pkg - Package id.
 * @param section - Section label.
 * @returns The page paths.
 */
function pagesIn(pkg: string, section: string): string[] {
  return DOC_SCREENS.filter(s => s.path.startsWith(`/docs/${pkg}/`) && s.section === section).map(
    s => s.path
  );
}

test.describe("game and editor docs", () => {
  for (const path of PAGES) {
    // Bug: a new docs page is missing, has the wrong title, or its sidebar drops a section, a page
    // or the current-page mark.
    test(`${path} renders with its sidebar sections and pages`, async ({ page }, testInfo) => {
      const phone = isPhone(testInfo.project.name);
      const pkg = path.split("/")[2] ?? "";
      const screen = DOC_SCREENS.find(s => s.path === path);
      expect(screen, "page in the corpus").toBeDefined();
      await boot(page, path);
      await expect(page.locator("h1").first()).toHaveText(screen?.title ?? "");
      if (phone) await sidebar(page).locator(":scope > summary").tap();
      await expect(sidebarNav(page)).toBeVisible();
      const groups = sidebarNav(page).locator(':scope > [data-part="group"]');
      await expect(groups.locator("h2")).toHaveText([...SECTIONS, "Elsewhere"]);
      for (const [index, section] of SECTIONS.entries()) {
        const expected = pagesIn(pkg, section);
        expect(expected.length, `${pkg} has ${section} pages`).toBeGreaterThan(0);
        const hrefs = await groups
          .nth(index)
          .locator("a")
          .evaluateAll(all => all.map(a => a.getAttribute("href")));
        expect(hrefs.toSorted(), `${pkg} ${section}`).toEqual(expected.toSorted());
      }
      await expect(sidebarNav(page).locator('a[aria-current="page"]')).toHaveCount(1);
      await expect(sidebarNav(page).locator('a[aria-current="page"]')).toHaveAttribute(
        "href",
        path
      );
    });
  }

  // Bug: a sidebar link of the new trees is dead or does a full reload into the wrong page.
  test("a game sidebar link opens its page", async ({ page }, testInfo) => {
    const phone = isPhone(testInfo.project.name);
    await boot(page, "/docs/game/quick-start/");
    if (phone) await sidebar(page).locator(":scope > summary").tap();
    const target = DOC_SCREENS.find(s => s.path === "/docs/game/plugins/flow/");
    await press(sidebarNav(page).locator('a[href="/docs/game/plugins/flow/"]'), phone);
    await expect(page).toHaveURL(/\/docs\/game\/plugins\/flow\/$/);
    await expect(page.locator("h1").first()).toHaveText(target?.title ?? "");
  });
});

test.describe("package home prompts", () => {
  // Bug: a package home lost its prompts or shows the landing's instead of its own.
  test("every package home shows three or four prompts of its own", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "chromium-desktop", "markup is the same on every project");
    const seen = new Map<string, string>();
    for (const id of PACKAGE_IDS) {
      await page.goto(`/docs/${id}/`);
      const copies = await page
        .locator('[data-content] figure[data-component="prompt"]')
        .evaluateAll(all => all.map(figure => (figure as HTMLElement).dataset.copy ?? ""));
      expect(copies.length, id).toBeGreaterThanOrEqual(3);
      expect(copies.length, id).toBeLessThanOrEqual(4);
      expect(new Set(copies).size, `${id} distinct`).toBe(copies.length);
      for (const copy of copies) {
        expect(copy.trim().length, id).toBeGreaterThan(0);
        expect(seen.get(copy), `"${copy}" is used by two packages`).toBeUndefined();
        seen.set(copy, id);
      }
    }
  });

  for (const id of ["game", "editor"]) {
    // Bug: a docs prompt's Copy copies another prompt or the build's markup.
    test(`/docs/${id}/: each prompt's Copy copies its own text`, async ({ page }, testInfo) => {
      const phone = isPhone(testInfo.project.name);
      await boot(page, `/docs/${id}/`);
      const prompts = page.locator('[data-content] figure[data-component="prompt"]');
      const count = await prompts.count();
      expect(count).toBeGreaterThanOrEqual(3);
      for (let index = 0; index < count; index++) {
        const figure = prompts.nth(index);
        await figure.scrollIntoViewIfNeeded();
        const copy = (await figure.getAttribute("data-copy")) ?? "";
        const shown = await figure.textContent();
        expect(shown ?? "").toContain(copy.trim());
        const button = figure.locator('[data-part="copy"]');
        await press(button, phone);
        expect(await clipboardAfterCopy(page, button), `${id} prompt ${index + 1}`).toBe(copy);
      }
    });
  }
});
