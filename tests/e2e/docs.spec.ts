/**
 * @file Docs features: sidebar (always open on desktop, a "pages" disclosure on phones), package
 * switcher, TOC scroll-spy, Copy as Markdown, code group tabs, code copy, code notes, sync badge
 * tip, prev/next, and the hub's concept and package cards.
 */
import type { Page } from "@playwright/test";
import {
  boot,
  clipboardAfterCopy,
  expect,
  fetchText,
  isPhone,
  point,
  press,
  test
} from "./_fixtures";
import { DOC_SCREENS, PACKAGE_IDS, RICH_DOC } from "./_inventory";

const sidebar = (page: Page) => page.locator('[data-component="docs-sidebar"]');
const sidebarNav = (page: Page) => sidebar(page).locator(":scope > nav");

test.describe("docs sidebar", () => {
  test("desktop: always open, active page marked, a link navigates", async ({ page }, testInfo) => {
    test.skip(isPhone(testInfo.project.name), "desktop layout");
    await boot(page, RICH_DOC);
    await expect(sidebar(page).locator(":scope > summary")).toBeHidden();
    await expect(sidebarNav(page)).toBeVisible();
    await expect(sidebarNav(page).locator('a[aria-current="page"]')).toHaveText("Routing");
    await sidebarNav(page).locator('a[href="/docs/web/guides/islands/"]').click();
    await expect(page).toHaveURL(/\/docs\/web\/guides\/islands\/$/);
    await expect(page.locator("h1").first()).toHaveText("Islands");
    await expect(sidebarNav(page).locator('a[aria-current="page"]')).toHaveText("Islands");
  });

  test("phone: a closed disclosure above the article that opens and navigates", async ({
    page
  }, testInfo) => {
    test.skip(!isPhone(testInfo.project.name), "phone layout");
    await boot(page, RICH_DOC);
    const summary = sidebar(page).locator(":scope > summary");
    await expect(summary).toBeVisible();
    await expect(summary).toContainText("@moku-labs/web pages");
    await expect(sidebarNav(page)).toBeHidden();
    const summaryBox = await summary.boundingBox();
    const titleBox = await page.locator("h1").first().boundingBox();
    expect(summaryBox?.y ?? 0).toBeLessThan(titleBox?.y ?? 0);
    expect(summaryBox?.height ?? 0).toBeGreaterThanOrEqual(40);
    await summary.tap();
    await expect(sidebarNav(page)).toBeVisible();
    await sidebarNav(page).locator('a[href="/docs/web/guides/data/"]').tap();
    await expect(page).toHaveURL(/\/docs\/web\/guides\/data\/$/);
    await expect(page.locator("h1").first()).toHaveText("Data");
    await expect(sidebarNav(page)).toBeHidden();
  });

  test("the package switcher lists every package and switches", async ({ page }, testInfo) => {
    const phone = isPhone(testInfo.project.name);
    await boot(page, RICH_DOC);
    if (phone) await sidebar(page).locator(":scope > summary").tap();
    const switcher = sidebar(page).locator('[data-part="switcher"]');
    await press(switcher.locator(":scope > summary"), phone);
    const items = switcher.locator("ul a");
    await expect(items).toHaveCount(PACKAGE_IDS.length - 0);
    await expect(items.first()).toBeVisible();
    await press(switcher.locator('a[href="/docs/core/"]'), phone);
    await expect(page).toHaveURL(/\/docs\/core\/$/);
    await expect(page.locator("h1").first()).toHaveText("@moku-labs/core");
  });
});

test.describe("on this page", () => {
  test("TOC marks the section in view and jumps to a heading", async ({ page }, testInfo) => {
    test.skip(isPhone(testInfo.project.name), "the TOC column shows on wide screens");
    await boot(page, RICH_DOC);
    const toc = page.locator('[data-component="docs-toc"]');
    await expect(toc).toBeVisible();
    const links = toc.locator('ul a[href^="#"]');
    await expect(links.first()).toHaveAttribute("data-current", "");
    await toc.locator('a[href="#links"]').click();
    await expect(page).toHaveURL(/#links$/);
    await expect(page.locator("#links")).toBeInViewport();
    await expect(toc.locator('a[href="#links"]')).toHaveAttribute("data-current", "");
    await expect(links.first()).not.toHaveAttribute("data-current", /.*/);
    await expect(toc.locator('[data-part="meta"] a')).toHaveCount(3);
  });

  test("TOC hides under 1200px", async ({ page }, testInfo) => {
    test.skip(isPhone(testInfo.project.name), "desktop resize");
    await page.setViewportSize({ width: 1100, height: 900 });
    await boot(page, RICH_DOC);
    await expect(page.locator('[data-component="docs-toc"]')).toBeHidden();
  });
});

test.describe("doc meta row", () => {
  test("Copy as Markdown copies the page's .md twin", async ({ page, request }, testInfo) => {
    const phone = isPhone(testInfo.project.name);
    await boot(page, RICH_DOC);
    const button = page.locator('[data-island="copy-page"]');
    await expect(button).toHaveText("Copy as Markdown");
    const { text: twin } = await fetchText(request, "/docs/web/guides/routing.md");
    await press(button, phone);
    expect(await clipboardAfterCopy(page, button)).toBe(twin);
    await expect(button).toHaveText("Copy as Markdown", { timeout: 4000 });
    await expect(
      page.locator('[data-component="doc-meta"] a[href="/docs/web/guides/routing.md"]')
    ).toBeVisible();
  });

  test("the sync badge explains itself", async ({ page }, testInfo) => {
    const phone = isPhone(testInfo.project.name);
    await boot(page, RICH_DOC);
    const badge = page.locator('[data-component="doc-meta"] > [data-component="sync-badge"]');
    await expect(badge).toHaveAttribute("data-state", "synced");
    await expect(badge).toContainText(
      /Synced with @moku-labs\/web v\d+\.\d+\.\d+ · checked \d{4}-\d\d-\d\d/
    );
    const tip = badge.locator('[data-part="tip"]');
    await expect(tip).toBeHidden();
    await point(badge, phone);
    await expect(tip).toBeVisible();
    await expect(tip).toBeInViewport({ ratio: 1 });
  });
});

test.describe("code blocks", () => {
  test("group tabs switch the file and copy copies the shown file", async ({ page }, testInfo) => {
    const phone = isPhone(testInfo.project.name);
    await boot(page, RICH_DOC);
    const group = page.locator('[data-component="code-group"]').first();
    await group.scrollIntoViewIfNeeded();
    const tabs = group.getByRole("tab");
    const figures = group.locator(":scope > figure");
    await expect(tabs).toHaveCount(3);
    await expect(tabs.first()).toHaveAttribute("aria-selected", "true");
    await expect(figures.nth(0)).toBeVisible();
    await expect(figures.nth(1)).toBeHidden();
    await press(tabs.nth(1), phone);
    await expect(tabs.nth(1)).toHaveAttribute("aria-selected", "true");
    await expect(tabs.first()).toHaveAttribute("aria-selected", "false");
    await expect(figures.nth(1)).toBeVisible();
    await expect(figures.nth(0)).toBeHidden();
    const expected = (await figures.nth(1).getAttribute("data-copy")) ?? "";
    const copy = group.locator(':scope > [data-part="copy"]');
    await press(copy, phone);
    expect(await clipboardAfterCopy(page, copy)).toBe(expected);
  });

  test("a plain code block and a terminal copy their text", async ({ page }, testInfo) => {
    const phone = isPhone(testInfo.project.name);
    await boot(page, "/docs/web/quick-start/");
    for (const kind of ["code", "terminal"]) {
      const figure = page
        .locator(`[data-content] figure[data-component="${kind}"]`)
        .filter({ hasNot: page.locator("xpath=ancestor::*[@data-component='code-group']") })
        .first();
      if ((await figure.count()) === 0) continue;
      await figure.scrollIntoViewIfNeeded();
      const button = figure.locator('[data-part="copy"]');
      const expected = (await figure.getAttribute("data-copy")) ?? "";
      await press(button, phone);
      expect(await clipboardAfterCopy(page, button)).toBe(expected);
    }
  });

  test("a code note lights its line", async ({ page }, testInfo) => {
    test.skip(isPhone(testInfo.project.name), "hover");
    await boot(page, RICH_DOC);
    const figure = page
      .locator('figure[data-component="code"]:has([data-component="code-notes"])')
      .first();
    await figure.scrollIntoViewIfNeeded();
    await expect(figure.locator('[data-part="note-marker"]').first()).toBeAttached();
    await figure.locator('[data-component="code-notes"] li[data-note="1"]').hover();
    await expect(figure.locator('[data-line][data-note~="1"]').first()).toHaveAttribute(
      "data-active",
      ""
    );
  });
});

test.describe("prev and next", () => {
  test("next and previous walk the docs in order", async ({ page }, testInfo) => {
    const phone = isPhone(testInfo.project.name);
    await boot(page, RICH_DOC);
    const pager = page.locator('[data-component="previous-next"]');
    await press(pager.locator('[data-direction="next"]'), phone);
    await expect(page).toHaveURL(/\/docs\/web\/guides\/islands\/$/);
    await expect(page.locator("h1").first()).toHaveText("Islands");
    await press(
      page.locator('[data-component="previous-next"] [data-direction="previous"]'),
      phone
    );
    await expect(page).toHaveURL(/\/docs\/web\/guides\/routing\/$/);
    await expect(page.locator("h1").first()).toHaveText("Routing");
  });

  test("every docs page has a pager whose links resolve", async ({ page, request }) => {
    for (const screen of DOC_SCREENS) {
      await page.goto(screen.path);
      const links = page.locator('[data-component="previous-next"] a');
      expect(await links.count(), screen.path).toBeGreaterThan(0);
      for (const href of await links.evaluateAll(all => all.map(a => a.getAttribute("href")))) {
        const { status } = await fetchText(request, href ?? "");
        expect(status, `${screen.path} → ${href}`).toBe(200);
      }
    }
  });
});

test.describe("docs hub", () => {
  test("concept cards and package cards open their docs", async ({ page }, testInfo) => {
    const phone = isPhone(testInfo.project.name);
    await boot(page, "/docs/");
    await expect(page.locator('[data-part="concepts"] a')).toHaveCount(5);
    for (const id of PACKAGE_IDS) {
      await expect(page.locator(`main a[href="/docs/${id}/"]`).first()).toBeVisible();
    }
    await press(page.locator('[data-part="concepts"] a').first(), phone);
    await expect(page).toHaveURL(/\/docs\/concepts\/three-layers\/$/);
  });
});
