/**
 * @file Regressions found by exploratory QA (phone first): the SPA progress bar is visible while a
 * page loads, a deep link puts its heading just under the sticky header, the page under the open
 * search palette stays put, and Start over works while a piece is still flying to the kernel.
 * Round 2: the world labels stay apart after a full run of every goal, a phone on its side shows the
 * kernel and the tray together, the tray holds new pieces while one is in flight, Back closes the
 * search palette, and a phone gets "On this page". Round 3 (UX gate): package names under the About
 * cubes, a Close button and a short placeholder in the phone search palette, tray cards named from
 * their label, 404 footer targets, and one row of doc-meta actions on a phone.
 */
import type { Page } from "@playwright/test";
import type { Goal } from "../../src/data/assembly";
import { appGoal, assemblyText, gameGoal, siteGoal } from "../../src/data/assembly";
import { fillText } from "../../src/lib/assembly";
import { boot, expect, isPhone, press, test } from "./_fixtures";
import { NOT_FOUND_PATH, RICH_DOC } from "./_inventory";

/** How far below the header's bottom edge an anchored heading may land, px. */
const ANCHOR_SLACK = 40;

/**
 * The bottom edge of the sticky header, px from the top of the viewport.
 *
 * @param page - The page.
 * @returns The header's bottom.
 */
function headerBottom(page: Page): Promise<number> {
  return page
    .locator('[data-component="site-header"]')
    .evaluate(header => header.getBoundingClientRect().bottom);
}

test("an SPA navigation shows a visible progress bar while the page loads", async ({
  page
}, testInfo) => {
  const phone = isPhone(testInfo.project.name);
  await boot(page, "/");
  // A slow network: the next page's data takes a while.
  await page.route("**/_data/**", async route => {
    await new Promise(resolve => setTimeout(resolve, 1500));
    await route.continue();
  });
  await press(page.locator('main a[href="/docs/"]').first(), phone);
  const bar = page.locator("[data-progress][data-active]");
  await expect(bar).toBeVisible();
  const box = await bar.boundingBox();
  expect(box?.height ?? 0).toBeGreaterThanOrEqual(2);
  expect(box?.y ?? -1).toBe(0);
  await expect(page).toHaveURL(/\/docs\/$/);
  await expect(page.locator("[data-progress][data-active]")).toHaveCount(0);
});

test("a deep link puts its heading just under the header", async ({ page }) => {
  await boot(page, `${RICH_DOC}#define-routes`);
  const heading = page.locator("[data-content] h2#define-routes");
  await expect(heading).toBeInViewport();
  const top = await heading.evaluate(element => element.getBoundingClientRect().top);
  const header = await headerBottom(page);
  expect(top).toBeGreaterThanOrEqual(header);
  expect(top - header).toBeLessThanOrEqual(ANCHOR_SLACK);
});

test("the page under the open search palette does not scroll", async ({ page }) => {
  await boot(page, RICH_DOC);
  await page.locator('[data-component="site-header"] [data-part="search"]').click();
  const palette = page.locator('[data-island="search-palette"]');
  await expect(palette).toBeVisible();
  // Wheel over the backdrop, below the panel.
  const viewport = page.viewportSize() ?? { width: 390, height: 844 };
  await page.mouse.move(viewport.width / 2, viewport.height - 40);
  await page.mouse.wheel(0, 800);
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => scrollY)).toBe(0);
  // Closed again, the page scrolls.
  await page.keyboard.press("Escape");
  await expect(palette).toBeHidden();
  await page.mouse.wheel(0, 800);
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(0);
});

/**
 * Margin around a name's box when two names are tested for overlap: the text halo, px. A callout
 * pill has no halo; its own padding keeps it off a name, so a pill only must not touch one.
 */
const HALO = 2;

/** Every goal with its pieces in a run order that makes one piece wait, where a goal has a need. */
const FULL_RUNS: readonly { goal: Goal; order: readonly string[] }[] = [
  { goal: siteGoal, order: ["comments", "content", "newsletter"] },
  { goal: appGoal, order: ["tasks", "d1", "kv"] },
  { goal: gameGoal, order: gameGoal.pieces.map(piece => piece.id) }
];

/**
 * Run one goal of the hero to its finish: every piece in, the app cube up.
 *
 * @param page - The page.
 * @param run - The goal and its run order.
 * @param run.goal - The goal.
 * @param run.order - Its piece ids, in the order they are added.
 * @param phone - Whether the project is a phone.
 */
async function fullRun(page: Page, run: { goal: Goal; order: readonly string[] }, phone: boolean) {
  const radio = page.locator(`[data-goal="${run.goal.id}"]`);
  if ((await radio.getAttribute("aria-checked")) !== "true") await press(radio, phone);
  await expect(radio).toHaveAttribute("aria-checked", "true");
  for (const id of run.order) {
    await press(page.locator(`[data-plug="${id}"]`), phone);
    await expect(page.locator(`[data-plug="${id}"]`)).toHaveAttribute(
      "data-state",
      /placed|waiting/
    );
  }
  await expect(page.locator('[data-labels] [data-callout="running"]:visible')).toHaveText(
    fillText(assemblyText.completion, { app: run.goal.app.name })
  );
  await expect(page.locator('svg[data-part="world"] [data-item="app"]')).toBeVisible();
}

/**
 * The world texts on show (names over cubes and sockets, the app's name, the callout pills)
 * whose boxes overlap another one's box; two names also keep the halo between them.
 *
 * @param page - The page.
 * @returns Pairs like `comments/content`; empty when every text stands clear.
 */
async function overlappingLabels(page: Page): Promise<string[]> {
  // A settling piece slides and the app cube rises: measure where they stay, not where they pass.
  await page.evaluate(() =>
    Promise.all(document.getAnimations().map(animation => animation.finished))
  );
  return page.evaluate(halo => {
    const texts = [
      ...document.querySelectorAll("[data-labels] [data-label], [data-labels] [data-callout]")
    ]
      .filter(text => text.checkVisibility() && text.textContent)
      .map(text => ({
        name: text.textContent ?? "",
        isPill: text.tagName === "g",
        box: text.getBoundingClientRect()
      }))
      .filter(text => text.box.width > 0);
    const hits: string[] = [];
    for (const [index, first] of texts.entries()) {
      for (const second of texts.slice(index + 1)) {
        const margin = first.isPill || second.isPill ? 0 : halo;
        const apart =
          first.box.right + margin <= second.box.left ||
          second.box.right + margin <= first.box.left ||
          first.box.bottom + margin <= second.box.top ||
          second.box.bottom + margin <= first.box.top;
        if (!apart) hits.push(`${first.name}/${second.name}`);
      }
    }
    return hits;
  }, HALO);
}

/**
 * Slow every Web Animation of the page, so a piece stays in flight long enough to act on it.
 *
 * @param page - The page (chromium: the rate goes through the DevTools protocol).
 * @param rate - Playback rate; 1 is normal speed.
 */
async function animationRate(page: Page, rate: number) {
  const session = await page.context().newCDPSession(page);
  await session.send("Animation.enable");
  await session.send("Animation.setPlaybackRate", { playbackRate: rate });
}

// Bug: after a full run the names over the cubes, the app's name and the completion strip were
// drawn on top of each other (the layout's width estimate was narrower than the real font).
test("world labels do not overlap after a full run of every goal", async ({ page }, testInfo) => {
  const phone = isPhone(testInfo.project.name);
  await boot(page, "/");
  for (const run of FULL_RUNS) {
    await fullRun(page, run, phone);
    expect(await overlappingLabels(page), run.goal.id).toEqual([]);
  }
});

test.describe("a phone on its side", () => {
  test.use({ viewport: { width: 844, height: 390 }, hasTouch: true });

  // Bug: on a landscape phone the labels were laid out for the wrong viewport and collided.
  test("world labels do not overlap after a full run of every goal", async ({ page }) => {
    await boot(page, "/");
    for (const run of FULL_RUNS) {
      await fullRun(page, run, false);
      expect(await overlappingLabels(page), run.goal.id).toEqual([]);
    }
  });

  // Bug: on a phone on its side the kernel and the tray never shared the screen, so a drag from
  // the tray to the kernel had to scroll the page mid-gesture (and the drop missed).
  test("the kernel and the tray share the screen, and a drag needs no scrolling", async ({
    page
  }) => {
    await boot(page, "/");
    const header = await headerBottom(page);
    const card = page.locator('[data-plug="content"]');
    // The world just under the header, where a visitor sees it: the tray beside it must fit too.
    await page.locator('[data-part="world-wrap"]').evaluate((element, top) => {
      scrollBy(0, element.getBoundingClientRect().top - top);
    }, header);
    const viewport = page.viewportSize() ?? { width: 844, height: 390 };
    const kernel = await page.locator('svg[data-part="world"] [data-item="core"]').boundingBox();
    const tray = await page.locator('[data-part="cards"]').boundingBox();
    if (!kernel || !tray) throw new Error("tray or kernel has no box");
    expect(kernel.y, "the kernel is under the header").toBeGreaterThanOrEqual(header - 1);
    expect(kernel.y + kernel.height).toBeLessThanOrEqual(viewport.height);
    expect(tray.y + tray.height).toBeLessThanOrEqual(viewport.height + 1);

    // Drag a piece from the tray onto the kernel without moving the page.
    const scrolled = await page.evaluate(() => scrollY);
    const from = await card.boundingBox();
    if (!from) throw new Error("tray card has no box");
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await page.mouse.down();
    await page.mouse.move(kernel.x + kernel.width / 2, kernel.y + kernel.height / 2, {
      steps: 12
    });
    await page.mouse.up();
    await expect(card).toHaveAttribute("data-state", "placed");
    expect(await page.evaluate(() => scrollY)).toBe(scrolled);
  });
});

test("Back closes the search palette and Esc leaves no history entry behind", async ({
  page
}, testInfo) => {
  const phone = isPhone(testInfo.project.name);
  await boot(page, "/");
  await press(page.locator('main a[href="/docs/"]').first(), phone);
  await expect(page).toHaveURL(/\/docs\/$/);
  const palette = page.locator('[data-island="search-palette"]');
  const opener = page.locator('[data-component="site-header"] [data-part="search"]');

  // Back with the palette open closes it and stays on the page.
  await press(opener, phone);
  await expect(palette).toBeVisible();
  await page.goBack();
  await expect(palette).toBeHidden();
  await expect(page).toHaveURL(/\/docs\/$/);

  // Esc closes it and pops its entry: the next Back leaves the page.
  await press(opener, phone);
  await expect(palette).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(palette).toBeHidden();
  await expect.poll(() => new URL(page.url()).hash).toBe("");
  await page.goBack();
  await expect(page).toHaveURL(url => url.pathname === "/");
});

test("a docs page offers On this page as a closed disclosure on a phone only", async ({
  page
}, testInfo) => {
  const phone = isPhone(testInfo.project.name);
  await boot(page, RICH_DOC);
  const inline = page.locator('[data-component="docs-toc-inline"]');
  if (!phone) {
    await expect(inline).toBeHidden();
    await expect(page.locator('aside[data-component="docs-toc"]')).toBeVisible();
    return;
  }
  await expect(inline).toBeVisible();
  await expect(inline).not.toHaveAttribute("open", /./);
  const summary = inline.locator("summary");
  const summaryBox = await summary.boundingBox();
  expect(summaryBox?.height ?? 0).toBeGreaterThanOrEqual(44);
  const headings = await page.locator('aside[data-component="docs-toc"] a[href^="#"]').count();
  await press(summary, true);
  await expect(inline.locator('a[href^="#"]')).toHaveCount(headings);
  await press(inline.locator('a[href="#define-routes"]'), true);
  await expect(page.locator("[data-content] h2#define-routes")).toBeInViewport();
});

test.describe("with motion", () => {
  test.use({ reducedMotion: "no-preference" });

  // Bug: while a piece flew to the kernel the tray looked ready, a second tap was lost or added
  // a second piece mid-flight, and the tray stayed stuck after the landing.
  test("the tray holds new pieces while a piece is in flight, then takes them again", async ({
    page
  }, testInfo) => {
    const phone = isPhone(testInfo.project.name);
    await boot(page, "/");
    await page.locator('[data-part="tray"]').scrollIntoViewIfNeeded();
    await animationRate(page, 0.1);
    await press(page.locator('[data-plug="content"]'), phone);
    await expect(page.locator('[data-part="flyer"][data-clone]')).toHaveCount(1);
    // A tap in flight neither adds the piece nor launches a second flyer.
    await press(page.locator('[data-plug="newsletter"]'), phone);
    await expect(page.locator('[data-part="flyer"][data-clone]')).toHaveCount(1);
    await expect(page.locator('[data-part="flyer"][data-clone]')).toHaveCount(0, {
      timeout: 10_000
    });
    await expect(page.locator('[data-plug="content"]')).toHaveAttribute("data-state", "placed");
    await expect(page.locator('[data-plug="newsletter"]')).not.toHaveAttribute(
      "data-state",
      "placed"
    );
    // Landed, the tray takes the next piece.
    await animationRate(page, 1);
    await press(page.locator('[data-plug="newsletter"]'), phone);
    await expect(page.locator('[data-plug="newsletter"]')).toHaveAttribute("data-state", "placed");
  });

  // Bug: Start over pressed while a piece was in flight let the piece land after the reset, so
  // the "clean" start showed a placed piece, a new code line and a stale log line.
  test("Start over while a piece is in flight leaves a clean start", async ({ page }, testInfo) => {
    const phone = isPhone(testInfo.project.name);
    await boot(page, "/");
    const hero = page.locator('[data-component="hero"]');
    const startCode = await hero.locator('ol[data-part="code"] li code').allTextContents();
    const startLog = await hero.locator('[data-part="log"] li').allTextContents();
    await page.locator('[data-part="tray"]').scrollIntoViewIfNeeded();
    await animationRate(page, 0.1);
    await press(page.locator('[data-plug="content"]'), phone);
    await expect(page.locator('[data-part="flyer"][data-clone]')).toBeAttached();
    await press(page.locator('[data-part="reset"]'), phone);
    await expect(page.locator('[data-part="flyer"][data-clone]')).toHaveCount(0, {
      timeout: 10_000
    });
    await expect(page.locator('[data-plug="content"]')).not.toHaveAttribute("data-state", "placed");
    await expect(page.locator('svg[data-part="world"] [data-item="content"]')).toHaveCount(0);
    await expect(page.locator('[data-socket="content"]')).toHaveCount(1);
    expect(await hero.locator('ol[data-part="code"] li code').allTextContents()).toEqual(startCode);
    expect(await hero.locator('[data-part="log"] li').allTextContents()).toEqual(startLog);
    // The kernel takes pieces again.
    await animationRate(page, 1);
    await press(page.locator('[data-plug="content"]'), phone);
    await expect(page.locator('[data-plug="content"]')).toHaveAttribute("data-state", "placed", {
      timeout: 5000
    });
  });
});

test("About names every package under its cube, and the grid stays inside the page", async ({
  page
}) => {
  await boot(page, "/about/");
  const items = page.locator('[data-part="ships"] li');
  const count = await items.count();
  expect(count).toBeGreaterThan(5);
  for (let index = 0; index < count; index++) {
    const name = items.nth(index).locator('[data-part="name"]');
    await expect(name).toBeVisible();
    await expect(name).not.toBeEmpty();
    const size = await name.evaluate(element =>
      Number.parseFloat(getComputedStyle(element).fontSize)
    );
    expect(size).toBeGreaterThanOrEqual(11);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
    page.viewportSize()?.width ?? 0
  );
});

test("the search palette has a Close button and a short placeholder on a phone only", async ({
  page
}, testInfo) => {
  const phone = isPhone(testInfo.project.name);
  await boot(page, "/docs/");
  const palette = page.locator('[data-island="search-palette"]');
  await press(page.locator('[data-component="site-header"] [data-part="search"]'), phone);
  await expect(palette).toBeVisible();
  const close = palette.getByRole("button", { name: "Close" });
  const input = palette.getByRole("combobox", { name: "Search docs" });
  if (!phone) {
    await expect(close).toBeHidden();
    await expect(palette.locator("kbd")).toBeVisible();
    await expect(input).toHaveAttribute("placeholder", "Search packages, guides, plugins, APIs");
    return;
  }
  await expect(palette.locator("kbd")).toBeHidden();
  await expect(palette.locator('[data-part="hint"]').first()).toBeHidden();
  await expect(input).toHaveAttribute("placeholder", "Search docs");
  const box = await close.boundingBox();
  expect(box?.height ?? 0).toBeGreaterThanOrEqual(40);
  expect(box?.width ?? 0).toBeGreaterThanOrEqual(40);
  await close.tap();
  await expect(palette).toBeHidden();
});

// Bug: a tray card's accessible name did not start with the words on the card (voice control
// users say what they see), or left out what pressing it does.
test("a tray card is named from its visible label, then the action", async ({ page }, testInfo) => {
  const phone = isPhone(testInfo.project.name);
  await boot(page, "/");
  for (const goal of [siteGoal, appGoal, gameGoal]) {
    await press(page.locator(`[data-goal="${goal.id}"]`), phone);
    await expect(page.locator(`[data-goal="${goal.id}"]`)).toHaveAttribute("aria-checked", "true");
    for (const piece of goal.pieces) {
      const card = page.locator(`[data-plug="${piece.id}"]`);
      const name = (await card.locator("b").textContent()) ?? "";
      const note = (await card.locator("small").textContent()) ?? "";
      expect(name).toBe(piece.id);
      const action =
        (await card.getAttribute("aria-disabled")) === "true"
          ? assemblyText.aria.cardWaiting
          : assemblyText.aria.cardAdd;
      await expect(card).toHaveAccessibleName(fillText(action, { piece: name, note }));
      expect((await card.getAttribute("aria-label")) ?? "").toMatch(new RegExp(`^${name}\\. `));
    }
  }
});

test("the 404 footer links are at least 40px tall on a phone", async ({ page }, testInfo) => {
  test.skip(!isPhone(testInfo.project.name), "the 40px rule is the phone footer");
  await boot(page, NOT_FOUND_PATH, { static: true });
  const heights = await page
    .locator('[data-component="site-footer"] a')
    .evaluateAll(links => links.map(link => link.getBoundingClientRect().height));
  expect(heights.length).toBeGreaterThan(5);
  for (const height of heights) expect(height).toBeGreaterThanOrEqual(40);
});

test("doc meta keeps its actions in one row with the badge under them on a phone", async ({
  page
}, testInfo) => {
  const phone = isPhone(testInfo.project.name);
  await boot(page, RICH_DOC);
  const meta = page.locator('[data-component="doc-meta"]').first();
  const tops = await meta
    .locator('[data-part="action"]')
    .evaluateAll(actions => actions.map(action => Math.round(action.getBoundingClientRect().top)));
  // Copy as Markdown is the only action left in the row.
  expect(tops).toHaveLength(1);
  expect(new Set(tops).size).toBe(1);
  if (!phone) return;
  const heights = await meta
    .locator('[data-part="action"]')
    .evaluateAll(actions => actions.map(action => action.getBoundingClientRect().height));
  for (const height of heights) expect(height).toBeGreaterThanOrEqual(40);
  const badge = await meta.locator('[data-component="sync-badge"]').first().boundingBox();
  const row = await meta.locator('[data-part="actions"]').boundingBox();
  expect(badge?.y ?? 0).toBeGreaterThanOrEqual((row?.y ?? 0) + (row?.height ?? 0) - 1);
});
