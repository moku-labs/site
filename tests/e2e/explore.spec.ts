/**
 * @file Regressions found by exploratory QA (phone first): the SPA progress bar is visible while a
 * page loads, a deep link puts its heading just under the sticky header, the page under the open
 * search palette stays put, and Reset works while a plugin is still flying to the kernel. Round 2:
 * the socket labels stay apart after a full run, a phone on its side shows the kernel and the tray
 * together, the tray shows when a plugin is in flight, Back closes the search palette, and a phone
 * gets "On this page". Round 3 (UX gate): package names under the About cubes, a Close button and a
 * short placeholder in the phone search palette, tray plugs named from their label, 404 footer
 * targets, and one row of doc-meta actions on a phone.
 */
import type { Page } from "@playwright/test";
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

/** Margin around a label box when two labels are tested for overlap: the text halo, px. */
const HALO = 2;

/**
 * Run the hero to its full state: four plugins in the sockets, two refusals on the way.
 *
 * @param page - The page.
 * @param phone - Whether the project is a phone.
 */
async function fullRun(page: Page, phone: boolean) {
  for (const id of ["blog", "start", "auth", "session", "auth"]) {
    await press(page.locator(`[data-plug="${id}"]`), phone);
  }
  await expect(page.locator('[data-part="log"] [data-kind="win"]')).toBeVisible();
}

/**
 * The names of the socket labels whose boxes (plus the halo) overlap another label's box.
 *
 * @param page - The page.
 * @returns Pairs like `session/router`; empty when every label stands clear.
 */
async function overlappingLabels(page: Page): Promise<string[]> {
  // The newest plugin snaps in from above: measure where it stays, not where it passes.
  await page.evaluate(() =>
    Promise.all(document.getAnimations().map(animation => animation.finished))
  );
  return page.evaluate(halo => {
    const labels = [...document.querySelectorAll('[data-part="plugin-label"]')]
      .filter(label => label.textContent)
      .map(label => ({ name: label.textContent ?? "", box: label.getBoundingClientRect() }));
    const hits: string[] = [];
    for (const [index, first] of labels.entries()) {
      for (const second of labels.slice(index + 1)) {
        const apart =
          first.box.right + halo <= second.box.left ||
          second.box.right + halo <= first.box.left ||
          first.box.bottom + halo <= second.box.top ||
          second.box.bottom + halo <= first.box.top;
        if (!apart) hits.push(`${first.name}/${second.name}`);
      }
    }
    return hits;
  }, HALO);
}

test("socket labels do not overlap after a full run", async ({ page }, testInfo) => {
  await boot(page, "/");
  await fullRun(page, isPhone(testInfo.project.name));
  await expect(page.locator('[data-part="socket"][data-filled]')).toHaveCount(4);
  expect(await overlappingLabels(page)).toEqual([]);
});

test.describe("a phone on its side", () => {
  test.use({ viewport: { width: 844, height: 390 }, hasTouch: true });

  test("socket labels do not overlap after a full run", async ({ page }) => {
    await boot(page, "/");
    await fullRun(page, false);
    expect(await overlappingLabels(page)).toEqual([]);
  });

  test("the kernel and the tray share the screen, and a drag needs no scrolling", async ({
    page
  }) => {
    await boot(page, "/");
    const header = await headerBottom(page);
    const frame = page.locator('[data-part="world-frame"]');
    await page.evaluate(
      top => window.scrollTo(0, top),
      (await frame.evaluate(element => element.getBoundingClientRect().top + scrollY)) - header
    );
    const viewport = page.viewportSize() ?? { width: 844, height: 390 };
    const kernel = await page.locator('[data-part="kernel"]').boundingBox();
    const tray = await page.locator('[data-part="tray"] ul').boundingBox();
    const world = await frame.boundingBox();
    expect(world?.height ?? Infinity).toBeLessThanOrEqual(viewport.height - header);
    expect(kernel?.y ?? -1).toBeGreaterThanOrEqual(header - 1);
    expect((kernel?.y ?? Infinity) + (kernel?.height ?? Infinity)).toBeLessThanOrEqual(
      viewport.height
    );
    expect((tray?.y ?? Infinity) + (tray?.height ?? Infinity)).toBeLessThanOrEqual(viewport.height);
    // The tray stands beside the world, not under it.
    expect(tray?.x ?? 0).toBeGreaterThanOrEqual((world?.x ?? 0) + (world?.width ?? 0) - 1);

    // Drag a plugin from the tray onto the kernel without moving the page.
    const scrolled = await page.evaluate(() => scrollY);
    const plug = await page.locator('[data-plug="blog"]').boundingBox();
    if (!plug || !kernel) throw new Error("tray or kernel is off screen");
    await page.mouse.move(plug.x + plug.width / 2, plug.y + plug.height / 2);
    await page.mouse.down();
    await page.mouse.move(kernel.x + kernel.width / 2, kernel.y + kernel.height / 2, { steps: 12 });
    await page.mouse.up();
    await expect(page.locator('[data-plug="blog"]')).toHaveAttribute("data-state", "locked");
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

  test("the tray shows it is busy while a plugin is in flight", async ({ page }, testInfo) => {
    const phone = isPhone(testInfo.project.name);
    await boot(page, "/");
    const tray = page.locator('[data-part="tray"]');
    await tray.scrollIntoViewIfNeeded();
    await expect(tray).not.toHaveAttribute("data-busy", /./);
    await press(page.locator('[data-plug="blog"]'), phone);
    await expect(tray).toHaveAttribute("data-busy", "");
    await expect(page.locator('[data-plug="session"]')).toHaveAttribute("aria-disabled", "true");
    expect(
      await page
        .locator('[data-plug="session"]')
        .evaluate(button => Number(getComputedStyle(button).opacity))
    ).toBeLessThan(1);
    await expect(tray).not.toHaveAttribute("data-busy", /./, { timeout: 5000 });
    await expect(page.locator('[data-plug="session"]')).not.toHaveAttribute("aria-disabled", /./);
  });

  test("Reset while a plugin is in flight empties the kernel", async ({ page }, testInfo) => {
    const phone = isPhone(testInfo.project.name);
    await boot(page, "/");
    await page.locator('[data-part="tray"]').scrollIntoViewIfNeeded();
    await press(page.locator('[data-plug="blog"]'), phone);
    await expect(page.locator('[data-part="flyer"][data-clone]')).toBeAttached();
    await press(page.locator('[data-part="reset"]'), phone);
    await expect(page.locator('[data-part="flyer"][data-clone]')).toHaveCount(0, {
      timeout: 5000
    });
    await expect(page.locator('[data-part="log"] li')).toHaveCount(1);
    await expect(page.locator('[data-part="app-arguments"]')).toHaveText("({ plugins: [] })");
    await expect(page.locator('[data-plug="blog"]')).not.toHaveAttribute("data-state", /./);
    await expect(page.locator('[data-part="socket"][data-filled]')).toHaveCount(0);
    // The kernel takes plugins again.
    await press(page.locator('[data-plug="router"]'), phone);
    await expect(page.locator('[data-plug="router"]')).toHaveAttribute("data-state", "locked", {
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

test("a tray plug is named from its visible label, then the action", async ({ page }) => {
  await boot(page, "/");
  for (const id of ["router", "blog", "auth", "session"]) {
    await expect(page.locator(`[data-plug="${id}"]`)).toHaveAttribute(
      "aria-label",
      `${id}. Plug into the kernel`
    );
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
  expect(tops).toHaveLength(3);
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
