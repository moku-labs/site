/**
 * @file Phone layout guard, every screen at 320, 390 and 430 wide: no sideways page scroll, no
 * control smaller than 40px tall (inline text links excepted), no visible text under 11px, and
 * the hero world readable (drawn at least as wide as the screen).
 */
import type { Page } from "@playwright/test";
import { boot, expect, isPhone, test } from "./_fixtures";
import { SCREENS } from "./_inventory";

const WIDTHS = [320, 390, 430];
const MIN_TARGET = 40;
const MIN_TEXT = 11;

/**
 * The page is wider than the screen: report it with the widest unclipped elements.
 *
 * @param page - The page.
 * @returns The problem, or nothing.
 */
function overflow(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const width = document.documentElement.clientWidth;
    if (document.documentElement.scrollWidth <= width + 1) return [];
    // An element past the right edge whose ancestors all let it show.
    const culprits = [...document.querySelectorAll("body *")]
      .filter(el => el.getBoundingClientRect().right > width + 1)
      .filter(el => {
        let up = el.parentElement;
        while (up && getComputedStyle(up).overflowX === "visible") up = up.parentElement;
        return up === null;
      })
      .slice(0, 3)
      .map(el => `${el.tagName.toLowerCase()} "${(el.textContent ?? "").slice(0, 30)}"`);
    const scroll = document.documentElement.scrollWidth;
    return [`page scrolls sideways: ${scroll} > ${width} (${culprits.join(", ")})`];
  });
}

/**
 * Controls shorter than the minimum: buttons, summaries, tabs and links that stand alone.
 *
 * @param page - The page.
 * @param min - Minimum height, px.
 * @returns One line per small control.
 */
function smallTargets(page: Page, min: number): Promise<string[]> {
  return page.evaluate(limit => {
    const inline =
      "p, td, th, figcaption, blockquote, [data-content] li, [data-component=code-notes]";
    const skipped = "svg, [hidden], [aria-hidden=true], [data-component=skip-link]";
    const small = (el: Element) => {
      const box = el.getBoundingClientRect();
      return box.width > 0 && box.height < limit - 0.5;
    };
    return [...document.querySelectorAll("button, summary, [role=button], [role=tab], a[href]")]
      .filter(el => small(el) && !el.closest(skipped))
      .filter(el => !(el.tagName === "A" && el.closest(inline)))
      .map(el => {
        const box = el.getBoundingClientRect();
        const name = (el.textContent ?? "").trim().slice(0, 24);
        const size = `${Math.round(box.width)}x${Math.round(box.height)}`;
        return `small target ${size}: ${el.tagName.toLowerCase()} "${name}"`;
      });
  }, min);
}

/**
 * Visible text set smaller than the minimum.
 *
 * @param page - The page.
 * @param min - Minimum font size, px.
 * @returns One line per element with small text.
 */
function smallText(page: Page, min: number): Promise<string[]> {
  return page.evaluate(limit => {
    const skipped = "svg, [hidden], [aria-hidden=true], [data-part=gutter]";
    const shown = (el: Element) => el.getBoundingClientRect().width > 0 && !el.closest(skipped);
    const found = new Set<string>();
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const el = node.parentElement;
      if (!(el && (node.nodeValue ?? "").trim() && shown(el))) continue;
      const size = Number.parseFloat(getComputedStyle(el).fontSize);
      const text = (el.textContent ?? "").trim().slice(0, 24);
      if (size < limit) found.add(`small text ${size}px: ${el.tagName.toLowerCase()} "${text}"`);
    }
    return [...found];
  }, min);
}

for (const screen of SCREENS) {
  test(`phone layout: ${screen.path}`, async ({ page }, testInfo) => {
    test.skip(!isPhone(testInfo.project.name), "phone widths");
    const problems: string[] = [];
    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: 844 });
      await boot(page, screen.path, { static: screen.static ?? false });
      const found = [
        ...(await overflow(page)),
        ...(await smallTargets(page, MIN_TARGET)),
        ...(await smallText(page, MIN_TEXT))
      ];
      problems.push(...found.map(problem => `${width}px ${problem}`));
    }
    expect([...new Set(problems)]).toEqual([]);
  });
}

test("hero world is drawn full width on a phone, labels readable", async ({ page }, testInfo) => {
  test.skip(!isPhone(testInfo.project.name), "phone");
  await boot(page, "/");
  const world = await page.locator('svg[data-part="world"]').boundingBox();
  expect(world?.width ?? 0).toBeGreaterThanOrEqual(360);
  const label = await page.locator('svg[data-part="world"] text').first().boundingBox();
  expect(label?.height ?? 0).toBeGreaterThanOrEqual(9);
});
