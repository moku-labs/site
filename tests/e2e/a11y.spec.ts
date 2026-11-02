/**
 * @file Accessibility: an axe WCAG 2.1 AA scan per screen (dark and light on the key screens),
 * committed ARIA snapshots of the chrome and key states, and role + name on the key controls.
 */
import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { boot, expect, isPhone, press, test } from "./_fixtures";
import { RICH_DOC, SCREENS } from "./_inventory";

const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

/**
 * Documented exceptions, each checked by hand:
 * - The desktop docs sidebar is a `<details>` kept open by CSS (`::details-content`). Its links
 *   are focusable and Tab reaches them, but axe treats closed-details content as unfocusable.
 * - Tray plugs ("router. Plug into the kernel") and the layer drawings ("Layer 1:
 *   createCoreConfig()") name the action and contain their visible label; the secondary note text
 *   is left out on purpose. The rule is experimental in axe.
 */
const ALLOWED: readonly { rule: string; target: RegExp }[] = [
  { rule: "scrollable-region-focusable", target: /^details\[data-component="docs-sidebar"\]$/ },
  { rule: "label-content-name-mismatch", target: /^button\[data-plug=|^g\[aria-label="Layer \d/ }
];

/**
 * Run axe and return one readable line per violating node.
 *
 * @param page - The page.
 * @returns Violations as `rule: target — summary`.
 */
async function violations(page: Page): Promise<string[]> {
  const result = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  return result.violations.flatMap(violation =>
    violation.nodes
      .filter(
        node =>
          !ALLOWED.some(
            allowed => allowed.rule === violation.id && allowed.target.test(node.target.join(" "))
          )
      )
      .map(
        node =>
          `${violation.id}: ${node.target.join(" ")} — ${node.failureSummary?.split("\n")[1] ?? ""}`
      )
  );
}

for (const screen of SCREENS) {
  test(`axe: ${screen.path}`, async ({ page }) => {
    await boot(page, screen.path, { static: screen.static ?? false });
    expect(await violations(page)).toEqual([]);
  });
}

for (const path of ["/", "/docs/", RICH_DOC, "/demos/", "/about/"]) {
  test(`axe light theme: ${path}`, async ({ page }) => {
    await boot(page, `${path}?theme=light`);
    expect(await violations(page)).toEqual([]);
  });
}

test("axe on open overlays: palette, menu, docs disclosure", async ({ page }, testInfo) => {
  const phone = isPhone(testInfo.project.name);
  await boot(page, RICH_DOC);
  await press(page.locator('[data-component="site-header"] [data-part="search"]'), phone);
  await page.getByRole("combobox", { name: "Search docs" }).fill("route");
  expect(await violations(page)).toEqual([]);
  await page.keyboard.press("Escape");
  if (phone) {
    await page.locator('[data-part="burger"]').tap();
    expect(await violations(page)).toEqual([]);
    await page.locator('[data-part="burger"]').tap();
    await page.locator('[data-component="docs-sidebar"] > summary').tap();
    expect(await violations(page)).toEqual([]);
  }
});

test("key controls have a role and a name", async ({ page }, testInfo) => {
  await boot(page, "/");
  const header = page.locator('[data-component="site-header"]');
  await expect(header.getByRole("link", { name: "Moku Labs home" })).toBeVisible();
  await expect(header.getByRole("button", { name: "Search docs" })).toBeVisible();
  await expect(header.getByRole("button", { name: /Switch to (light|dark) theme/ })).toBeVisible();
  const primary = isPhone(testInfo.project.name)
    ? header.getByRole("button", { name: "Menu" })
    : header.getByRole("navigation", { name: "Main" });
  await expect(primary).toBeVisible();
  await expect(page.getByRole("button", { name: "blog. Plug into the kernel" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Reset" })).toBeVisible();
  await expect(page.getByRole("group", { name: /Isometric map of the Moku family/ })).toBeVisible();
});

test("ARIA snapshot: header and footer", async ({ page }, testInfo) => {
  await boot(page, "/");
  await expect(page.locator('[data-component="site-header"]')).toMatchAriaSnapshot({
    name: `header-${testInfo.project.name}.aria.yml`
  });
  await expect(page.locator('[data-component="site-footer"]')).toMatchAriaSnapshot({
    name: "footer.aria.yml"
  });
});

test("ARIA snapshot: docs sidebar and meta row", async ({ page }, testInfo) => {
  const phone = isPhone(testInfo.project.name);
  await boot(page, RICH_DOC);
  if (phone) await page.locator('[data-component="docs-sidebar"] > summary').tap();
  await expect(page.locator('[data-component="docs-sidebar"]')).toMatchAriaSnapshot({
    name: "docs-sidebar.aria.yml"
  });
  await expect(page.locator('[data-component="doc-meta"]')).toMatchAriaSnapshot({
    name: "doc-meta.aria.yml"
  });
});

test("ARIA snapshot: search palette and demo filters", async ({ page }, testInfo) => {
  const phone = isPhone(testInfo.project.name);
  await boot(page, "/demos/");
  await expect(page.locator('[data-part="filters"]')).toMatchAriaSnapshot({
    name: "demo-filters.aria.yml"
  });
  await press(page.locator('[data-component="site-header"] [data-part="search"]'), phone);
  await expect(page.getByRole("dialog", { name: "Search docs" })).toMatchAriaSnapshot({
    name: `search-suggested-${testInfo.project.name}.aria.yml`
  });
});
