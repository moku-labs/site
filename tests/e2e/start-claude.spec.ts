/**
 * @file The landing's "Start with Claude" prompts: the build renders the first four of the pool,
 * the `code-block` island swaps in four distinct ones from the pool on mount, each Copy button
 * copies the text it sits next to, and the swap moves nothing (the section keeps its height).
 */
import type { Page } from "@playwright/test";
import { LANDING_PROMPT_COUNT, landingPrompts } from "../../src/data/prompts";
import { boot, clipboardAfterCopy, expect, isPhone, press, test } from "./_fixtures";

const promptsRoot = (page: Page) => page.locator('[data-component="claude-prompts"]');
const figures = (page: Page) => promptsRoot(page).locator('figure[data-component="prompt"]');

/**
 * The visible text and the copy value of every prompt figure.
 *
 * @param page - The page.
 * @returns One `{ text, copy }` per figure.
 */
function promptsOf(page: Page): Promise<{ text: string; copy: string }[]> {
  return figures(page).evaluateAll(all =>
    all.map(figure => ({
      text: figure.querySelector('[data-part="text"]')?.textContent?.trim() ?? "",
      copy: (figure as HTMLElement).dataset.copy ?? ""
    }))
  );
}

/**
 * Heights that must not move when the island mounts: the whole section and each prompt figure.
 *
 * @param page - The page.
 * @returns The section height and the figure heights, in CSS pixels.
 */
function heightsOf(page: Page): Promise<{ section: number; figures: number[] }> {
  return page.evaluate(() => ({
    section: document.querySelector("#start")?.getBoundingClientRect().height ?? -1,
    figures: [...document.querySelectorAll('[data-component="claude-prompts"] figure')].map(
      figure => figure.getBoundingClientRect().height
    )
  }));
}

test.describe("landing prompts, no JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  // Bug: the build renders no prompts, a different number, or text the copy value does not match.
  test("the build renders the first four prompts of the pool", async ({ page }) => {
    await page.goto("/", { waitUntil: "load" });
    expect(await promptsOf(page)).toEqual(
      landingPrompts.slice(0, LANDING_PROMPT_COUNT).map(text => ({ text, copy: text }))
    );
  });
});

test.describe("landing prompts", () => {
  // Bug: the swap shows fewer or more than four, repeats one, writes a line that is not in the
  // pool, or leaves a copy value that differs from the visible text.
  test("after mount: exactly four distinct prompts from the pool", async ({ page }) => {
    await boot(page, "/");
    await expect(figures(page).locator('[data-part="copy"]')).toHaveCount(LANDING_PROMPT_COUNT);
    const shown = await promptsOf(page);
    expect(shown).toHaveLength(LANDING_PROMPT_COUNT);
    for (const prompt of shown) {
      expect(landingPrompts, "a pool line").toContain(prompt.text);
      expect(prompt.copy, "copy value = visible text").toBe(prompt.text);
    }
    expect(new Set(shown.map(prompt => prompt.text)).size, "distinct").toBe(LANDING_PROMPT_COUNT);
  });

  // Bug: the island never swaps (the build's four stay forever). With a random that always
  // returns its top value, the pick is the last four of the pool, last first.
  test("the swap draws from Math.random", async ({ page }) => {
    await page.addInitScript(() => {
      Math.random = () => 1 - 1e-9;
    });
    await boot(page, "/");
    await expect(figures(page).locator('[data-part="copy"]')).toHaveCount(LANDING_PROMPT_COUNT);
    const shown = await promptsOf(page);
    expect(shown.map(prompt => prompt.text)).toEqual(
      landingPrompts.slice(-LANDING_PROMPT_COUNT).toReversed()
    );
  });

  // Bug: a Copy button copies the build's prompt (or a neighbour's) instead of the line beside it.
  test("each Copy button copies exactly its own visible text", async ({ page }, testInfo) => {
    const phone = isPhone(testInfo.project.name);
    await boot(page, "/");
    await promptsRoot(page).scrollIntoViewIfNeeded();
    for (let index = 0; index < LANDING_PROMPT_COUNT; index++) {
      const figure = figures(page).nth(index);
      const line = await figure.locator('[data-part="text"]').textContent();
      const visible = (line ?? "").trim();
      const button = figure.locator('[data-part="copy"]');
      await expect(button).toHaveText("Copy");
      await press(button, phone);
      expect(await clipboardAfterCopy(page, button), `prompt ${index + 1}`).toBe(visible);
    }
  });

  // Bug: the swap (or the Copy buttons it adds) changes the section's height, so the page jumps
  // after paint; or a pool prompt wraps past the two lines the figure reserves.
  test("no layout shift: the section keeps its height when the island mounts", async ({
    page
  }, testInfo) => {
    const { promise: held, resolve: release } = Promise.withResolvers<void>();
    // Hold the client bundle: the build's markup paints, the island has not mounted yet.
    await page.route(/\/assets\/.*\.js$/, async route => {
      await held;
      await route.continue();
    });
    await page.goto("/", { waitUntil: "commit" });
    await expect(figures(page)).toHaveCount(LANDING_PROMPT_COUNT);
    await page.evaluate(() => document.fonts.ready);
    await expect(figures(page).locator('[data-part="copy"]')).toHaveCount(0);
    const before = await heightsOf(page);

    release();
    await expect(figures(page).locator('[data-part="copy"]')).toHaveCount(LANDING_PROMPT_COUNT);
    await page.evaluate(() => document.fonts.ready);
    const after = await heightsOf(page);
    expect(after.section).toBeCloseTo(before.section, 0);
    expect(after.figures).toHaveLength(before.figures.length);
    for (const [index, height] of after.figures.entries()) {
      expect(height, `figure ${index + 1}`).toBeCloseTo(before.figures[index] ?? -1, 0);
    }

    // Any pool line fits the reserved height at every width of the device, so every random pick
    // is shift-free.
    const widths = isPhone(testInfo.project.name) ? [430, 390, 320] : [1440, 1024, 761];
    for (const width of widths) {
      await page.setViewportSize({ width, height: 900 });
      const misses = await page.evaluate(pool => {
        const figure = document.querySelector('[data-component="claude-prompts"] figure');
        const line = figure?.querySelector('[data-part="text"]');
        if (!figure || !line) return ["no figure"];
        const reserved = figure.getBoundingClientRect().height;
        const saved = line.textContent;
        const found: string[] = [];
        for (const prompt of pool) {
          line.textContent = prompt;
          const height = figure.getBoundingClientRect().height;
          if (Math.abs(height - reserved) > 0.5) found.push(`${prompt}: ${height} vs ${reserved}`);
        }
        line.textContent = saved;
        return found;
      }, landingPrompts);
      expect(misses, `${width}px`).toEqual([]);
    }
  });
});
