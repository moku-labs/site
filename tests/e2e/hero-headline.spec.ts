/**
 * @file The hero H1 ("The agentic framework for reliable software.") and its sub fit their column
 * at every width: no line runs past the intro column into the kernel world. Regression guard for
 * the two-column hero (above 960px), where 6.2vw alone set "framework" wider than the column.
 */
import type { Page } from "@playwright/test";
import { boot, expect, isPhone, test } from "./_fixtures";

/** Phone, tablet (one column) and desktop (two columns) widths, both sides of the 960px switch. */
const WIDTHS = [320, 390, 768, 961, 1024, 1280, 1440, 1920] as const;

/**
 * How far each line of an element runs past the hero's intro column, in px.
 *
 * @param page - The page.
 * @param selector - The element inside the intro column.
 * @returns The worst overrun (0 or less means it fits) and the element's own scroll overflow.
 */
async function overrun(page: Page, selector: string): Promise<{ lines: number; scroll: number }> {
  return page.evaluate(sel => {
    const intro = document.querySelector('[data-component="hero"] [data-part="intro"]');
    const element = document.querySelector<HTMLElement>(`[data-component="hero"] ${sel}`);
    if (intro === null || element === null) return { lines: Number.POSITIVE_INFINITY, scroll: 0 };
    const right = intro.getBoundingClientRect().right;
    const range = document.createRange();
    range.selectNodeContents(element);
    const worst = Math.max(...Array.from(range.getClientRects(), rect => rect.right - right));
    return { lines: worst, scroll: element.scrollWidth - element.clientWidth };
  }, selector);
}

test("the hero H1 and sub stay inside the intro column at every width", async ({
  page
}, testInfo) => {
  test.skip(isPhone(testInfo.project.name), "widths are set explicitly; desktop runs them all");
  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: 900 });
    await boot(page, "/");
    await expect(page.locator("h1")).toHaveText("The agentic framework for reliable software.");
    for (const selector of ["h1", '[data-part="sub"]']) {
      const { lines, scroll } = await overrun(page, selector);
      expect(lines, `${selector} line past the column at ${width}px`).toBeLessThanOrEqual(1);
      expect(scroll, `${selector} scroll overflow at ${width}px`).toBeLessThanOrEqual(1);
    }
    const overflowX = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    expect(overflowX, `page scrolls sideways at ${width}px`).toBeLessThanOrEqual(0);
  }
});
