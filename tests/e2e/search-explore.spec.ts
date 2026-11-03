/**
 * @file What exploratory QA found around the ⌘K palette and its fragment landing that the scripted
 * specs did not name: the keys that reach it, a result that lands on nothing, rows no one can tell
 * apart, the page state under it without the Navigation API, and the table of contents as it follows
 * a jump. Every test asserts the correct behaviour of an open finding, reported and not fixed here,
 * so each is a `fixme`: it was run red on the bug. Drop the `fixme` with the fix.
 */
import { readFileSync } from "node:fs";
import nodePath from "node:path";
import type { Page } from "@playwright/test";
import { boot, expect, isPhone, press, test } from "./_fixtures";

const DOCS_DIR = nodePath.join(import.meta.dirname, "../../content/docs");

const palette = (page: Page) => page.locator('[data-island="search-palette"]');
const input = (page: Page) => palette(page).getByRole("combobox", { name: "Search docs" });
const options = (page: Page) => palette(page).getByRole("option");
const opener = (page: Page) => page.locator('[data-component="site-header"] [data-part="search"]');
const toc = (page: Page) => page.locator('aside[data-component="docs-toc"]');

/**
 * Open the palette from the header and wait for the index.
 *
 * @param page - The page.
 * @param phone - Whether the project is a phone.
 */
async function openPalette(page: Page, phone: boolean) {
  await press(opener(page), phone);
  await expect(palette(page)).toBeVisible();
  await expect(options(page).first()).toBeVisible();
}

/**
 * Type a query and wait until its rows are painted: the palette paints on the next frame.
 *
 * @param page - The page.
 * @param query - The query.
 */
async function ask(page: Page, query: string) {
  await input(page).fill(query);
  await page.evaluate(
    () =>
      new Promise<void>(resolve => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      })
  );
}

test.describe("keys", () => {
  // Bug: closing gives focus back to the header's button, so a second Enter presses that button and
  // the palette opens again over the page just chosen.
  test("Enter pressed twice on a result leaves the palette closed", async ({ page }, testInfo) => {
    test.skip(isPhone(testInfo.project.name), "a hardware keyboard");
    await boot(page, "/");
    await openPalette(page, false);
    await ask(page, "fx");
    await page.keyboard.press("Enter");
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/docs\/game\/plugins\/effects\/$/);
    await page.waitForTimeout(300);
    await expect(palette(page)).toBeHidden();
  });

  // Bug: every repeat of a held ⌘K toggles the palette, so it flickers and pushes history entries.
  test.fixme("a held shortcut opens the palette once", async ({ page }, testInfo) => {
    test.skip(isPhone(testInfo.project.name), "a hardware keyboard");
    await boot(page, "/docs/");
    await page.keyboard.down("ControlOrMeta");
    await page.keyboard.down("k");
    await expect(palette(page)).toBeVisible();
    await page.keyboard.down("k");
    await page.keyboard.up("k");
    await page.keyboard.up("ControlOrMeta");
    await page.waitForTimeout(200);
    await expect(palette(page)).toBeVisible();
  });

  // Bug: the shortcut reads `key`, and a Cyrillic layout reports `л` for the K key.
  test("the shortcut works on a non-Latin keyboard layout", async ({ page }, testInfo) => {
    test.skip(isPhone(testInfo.project.name), "a hardware keyboard");
    await boot(page, "/docs/");
    await page.evaluate(() => {
      const init = { key: "л", code: "KeyK", ctrlKey: true, bubbles: true, cancelable: true };
      document.dispatchEvent(new KeyboardEvent("keydown", init));
    });
    await expect(palette(page)).toBeVisible();
  });

  // Bug: the shortcut ignores Shift, so it takes ⌘⇧K and Ctrl+Shift+K from the browser.
  test("the shortcut with Shift is left to the browser", async ({ page }, testInfo) => {
    test.skip(isPhone(testInfo.project.name), "a hardware keyboard");
    await boot(page, "/docs/");
    await page.keyboard.press("ControlOrMeta+Shift+k");
    await page.waitForTimeout(100);
    await expect(palette(page)).toBeHidden();
  });

  // Bug: the Enter that commits an IME composition opens a result, and its Esc closes the palette.
  for (const [key, name] of [
    ["Enter", "opens no result"],
    ["Escape", "does not close the palette"]
  ] as const) {
    test.fixme(`${key} during an IME composition ${name}`, async ({ page }, testInfo) => {
      await boot(page, "/docs/");
      await openPalette(page, isPhone(testInfo.project.name));
      await ask(page, "fx");
      await input(page).evaluate((element, pressed) => {
        const init = { key: pressed, isComposing: true, bubbles: true, cancelable: true };
        element.dispatchEvent(new KeyboardEvent("keydown", init));
      }, key);
      await page.waitForTimeout(200);
      await expect(palette(page)).toBeVisible();
      await expect(page).toHaveURL(/\/docs\/#search$/);
    });
  }

  // Bug: the Tab ring holds only the input and the links, so the Close button on screen is out of it.
  test.fixme("Tab reaches the Close button in a narrow window", async ({ page }, testInfo) => {
    test.skip(isPhone(testInfo.project.name), "a hardware keyboard");
    await page.setViewportSize({ width: 700, height: 800 });
    await boot(page, "/docs/");
    await openPalette(page, false);
    const close = palette(page).getByRole("button", { name: "Close" });
    await expect(close).toBeVisible();
    await page.keyboard.press("Tab");
    await expect(close).toBeFocused();
  });
});

test.describe("results", () => {
  // Bug: the filter keeps the card hidden, so the palette closes, the URL changes and nothing shows.
  test("a demo hidden by the filter is shown when the palette opens it", async ({
    page
  }, testInfo) => {
    const phone = isPhone(testInfo.project.name);
    await boot(page, "/demos/");
    await press(page.locator('[data-part="filters"] [data-filter="room"]'), phone);
    const card = page.locator('[id="tracker"]');
    await expect(card).toBeHidden();
    await openPalette(page, phone);
    await ask(page, "Tracker");
    await expect(options(page).first()).toHaveAttribute("href", "/demos/#tracker");
    await press(options(page).first(), phone);
    await expect(palette(page)).toBeHidden();
    await expect(page).toHaveURL(/\/demos\/#tracker$/);
    await expect(card).toBeInViewport();
  });

  // Bug: the landing from another page replaces the URL with the fragment it already has, so no
  // `hashchange` fires, and a filter left on the demos page must not hide the card.
  test("a demo opened from another page after a filter is in view", async ({ page }, testInfo) => {
    const phone = isPhone(testInfo.project.name);
    await boot(page, "/demos/");
    await press(page.locator('[data-part="filters"] [data-filter="room"]'), phone);
    const card = page.locator('[id="tracker"]');
    await expect(card).toBeHidden();
    await press(page.locator('[data-component="site-header"] [data-part="logo"]'), phone);
    await expect(page).toHaveURL(url => url.pathname === "/");
    await openPalette(page, phone);
    await ask(page, "Tracker");
    await press(options(page).first(), phone);
    await expect(page).toHaveURL(/\/demos\/#tracker$/);
    await expect(page.locator('[id="tracker"]')).toBeInViewport();
  });

  // Bug: closing the palette goes back to the fragment URL, so `hashchange` takes the card the visitor
  // just filtered away for one to show: the filter is gone and the page jumps.
  test("Esc in the palette keeps a filter that hides the fragment's card", async ({
    page
  }, testInfo) => {
    const phone = isPhone(testInfo.project.name);
    await boot(page, "/demos/#tracker");
    const room = page.locator('[data-part="filters"] [data-filter="room"]');
    await press(room, phone);
    const card = page.locator('[id="tracker"]');
    await expect(card).toBeHidden();
    const scroll = await page.evaluate(() => scrollY);
    await openPalette(page, phone);
    await page.keyboard.press("Escape");
    await expect(palette(page)).toBeHidden();
    await page.waitForTimeout(300);
    await expect(room).toHaveAttribute("aria-pressed", "true");
    await expect(card).toBeHidden();
    expect(await page.evaluate(() => scrollY)).toBe(scroll);
  });

  // Bug: a Cmd click closes the palette behind the new tab, a middle click leaves it open.
  test.fixme("a middle click opens a new tab and closes the palette", async ({
    page,
    context
  }, testInfo) => {
    test.skip(isPhone(testInfo.project.name), "a mouse");
    await boot(page, "/docs/");
    await openPalette(page, false);
    await ask(page, "fx");
    const popup = context.waitForEvent("page");
    await options(page).first().click({ button: "middle" });
    const tab = await popup;
    await tab.close();
    await expect(palette(page)).toBeHidden();
    await expect(page).toHaveURL(url => url.pathname === "/docs/" && url.hash === "");
  });

  // Bug: a section row says only its heading and its page, so `createApp` lists seven rows that read
  // the same, to the eye and to a screen reader; only a 34px icon tells their packages apart.
  test("the rows of one query can be told apart by their text", async ({ page }, testInfo) => {
    await boot(page, "/");
    await openPalette(page, isPhone(testInfo.project.name));
    await ask(page, "createApp");
    const rows = await options(page).allTextContents();
    expect(rows.length).toBeGreaterThan(1);
    expect(rows.length - new Set(rows).size, rows.join(" / ")).toBe(0);
  });

  // Bug: each word keeps at most 60 body postings, and a query must match all its words, so two words
  // that stand side by side in the docs answer "Nothing matches".
  for (const [phrase, file, path] of [
    ["official plugins", "native/how-it-works.md", "/docs/native/how-it-works/"],
    ["browser library", "room/quick-start.md", "/docs/room/quick-start/"]
  ] as const) {
    test(`"${phrase}" finds the page that says it`, async ({ page }, testInfo) => {
      expect(readFileSync(nodePath.join(DOCS_DIR, file), "utf8")).toContain(phrase);
      await boot(page, "/");
      await openPalette(page, isPhone(testInfo.project.name));
      await ask(page, phrase);
      const hrefs = await options(page).evaluateAll(all =>
        all.map(option => option.getAttribute("href") ?? "")
      );
      expect(
        hrefs.some(href => href.startsWith(path)),
        hrefs.join(" ")
      ).toBe(true);
    });
  }
});

test.describe("fragments", () => {
  // Bug: the landing runs on a Back too, and takes a scroll of 0 for a page still to land, so a page
  // the visitor had scrolled back to the top comes back at its fragment.
  test.fixme("Back to a fragment URL left at the top stays at the top", async ({
    page
  }, testInfo) => {
    const phone = isPhone(testInfo.project.name);
    await boot(page, "/docs/web/guides/routing/#builder-methods");
    await page.evaluate(() => window.scrollTo(0, 0));
    await expect.poll(() => page.evaluate(() => scrollY)).toBe(0);
    await press(page.locator('[data-component="site-header"] [data-part="logo"]'), phone);
    await expect(page).toHaveURL(url => url.pathname === "/");
    await page.goBack();
    await expect(page).toHaveURL(/\/routing\/#builder-methods$/);
    await page.waitForTimeout(300);
    expect(await page.evaluate(() => scrollY)).toBe(0);
  });
});

// Safari before 26.2 has no Navigation API. WebKit is not installed in this run: this is the
// framework's history fallback on Chromium, as in `search-queries.spec.ts`.
test.describe("without the Navigation API", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(globalThis, "navigation", { value: undefined, configurable: true });
    });
  });

  // Bug: the fallback's `popstate` renders the page again for a fragment-only pop, so opening and
  // closing the palette remounts every island and the visitor's work in them is gone.
  test.fixme("opening and closing the palette keeps the hero's progress", async ({
    page
  }, testInfo) => {
    const phone = isPhone(testInfo.project.name);
    await boot(page, "/");
    const piece = page.locator('[data-plug="content"]');
    await press(piece, phone);
    await expect(piece).toHaveAttribute("data-state", "placed");
    await openPalette(page, phone);
    await page.keyboard.press("Escape");
    await expect(palette(page)).toBeHidden();
    await page.waitForTimeout(300);
    await expect(piece).toHaveAttribute("data-state", "placed");
  });

  // Bug: the same `popstate` restores the scroll saved when the page was last left.
  test.fixme("closing the palette keeps the scroll, not the one saved on the last visit", async ({
    page
  }, testInfo) => {
    test.skip(isPhone(testInfo.project.name), "the side column");
    await boot(page, "/docs/web/guides/routing/");
    await page.evaluate(() => window.scrollTo(0, 500));
    await expect.poll(() => page.evaluate(() => scrollY)).toBe(500);
    await page
      .locator('[data-component="docs-sidebar"] nav a[href="/docs/web/guides/islands/"]')
      .click();
    await expect(page).toHaveURL(/\/islands\/$/);
    await page.goBack();
    await expect(page).toHaveURL(/\/routing\/$/);
    await expect(page.locator("h1").first()).toHaveText("Routing");
    await page.evaluate(() => window.scrollTo(0, 3000));
    await expect.poll(() => page.evaluate(() => scrollY)).toBe(3000);
    await page.keyboard.press("ControlOrMeta+k");
    await expect(palette(page)).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(palette(page)).toBeHidden();
    await page.waitForTimeout(300);
    expect(await page.evaluate(() => scrollY)).toBe(3000);
  });
});

test.describe("table of contents", () => {
  // Bug: the spy marks the last heading above its line, so a jump to a short section marks a later
  // one: on a plugin page, Emits marks Depends on.
  test.fixme("a jump marks the heading it landed on", async ({ page }, testInfo) => {
    test.skip(isPhone(testInfo.project.name), "the side column");
    await boot(page, "/docs/web/plugins/router/");
    const link = toc(page).getByRole("link", { name: "Emits", exact: true });
    await link.click();
    await expect(page).toHaveURL(/#emits$/);
    await expect(link).toHaveAttribute("data-current", "");
  });

  // Bug: the sticky list is taller than the screen and does not scroll, so the current link sits
  // below the fold and the last links cannot be reached until the page ends.
  test.fixme("the current link stays on screen on the longest list", async ({ page }, testInfo) => {
    test.skip(isPhone(testInfo.project.name), "the side column");
    await boot(page, "/docs/game/api/");
    const below = await toc(page).evaluate(async aside => {
      const missed: string[] = [];
      for (const link of aside.querySelectorAll("ul a")) {
        const id = decodeURIComponent(link.getAttribute("href")?.slice(1) ?? "");
        document.querySelector(`[id="${id}"]`)?.scrollIntoView();
        await new Promise(resolve => {
          requestAnimationFrame(() => requestAnimationFrame(resolve));
        });
        const current = aside.querySelector("ul a[data-current]");
        const bottom = current?.getBoundingClientRect().bottom ?? 0;
        if (bottom > innerHeight) missed.push(`${current?.textContent} at ${bottom}`);
      }
      return missed;
    });
    expect(below).toEqual([]);
  });
});
