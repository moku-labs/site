/**
 * @file Link integrity: every internal link on every screen resolves (no dead or off-route links),
 * every in-page anchor has a target, and external links open safely.
 */
import type { Page } from "@playwright/test";
import { expect, fetchText, test } from "./_fixtures";
import { SCREENS } from "./_inventory";

type Link = { href: string; target: string | null; rel: string };

/**
 * Every link on the current page.
 *
 * @param page - The page.
 * @returns href, target and rel of each link.
 */
function linksOf(page: Page): Promise<Link[]> {
  return page.locator("a[href]").evaluateAll(all =>
    all.map(a => ({
      href: a.getAttribute("href") ?? "",
      target: a.getAttribute("target"),
      rel: a.getAttribute("rel") ?? ""
    }))
  );
}

/**
 * Check one external link: a new tab must not get `window.opener`.
 *
 * @param link - The link.
 * @returns The problem, if any.
 */
function externalProblem(link: Link): string[] {
  return link.target === "_blank" && !link.rel.includes("noopener")
    ? [`${link.href} opens without noopener`]
    : [];
}

/**
 * Whether an in-page anchor points at an element on the page.
 *
 * @param page - The page.
 * @param href - `#id`.
 * @returns True when the id exists (or the anchor is the top of the page).
 */
async function hasTarget(page: Page, href: string): Promise<boolean> {
  const id = decodeURIComponent(href.slice(1));
  return id === "" || (await page.locator(`[id="${id}"]`).count()) > 0;
}

/**
 * The link problems of one screen. Internal paths are fetched once per run (`statuses`).
 *
 * @param page - The page, already on the screen.
 * @param request - Playwright's request context.
 * @param statuses - Status by path, shared across screens.
 * @returns One line per problem.
 */
async function problemsOf(
  page: Page,
  request: Parameters<typeof fetchText>[0],
  statuses: Map<string, number>
): Promise<string[]> {
  const problems: string[] = [];
  for (const link of await linksOf(page)) {
    if (link.href.startsWith("#")) {
      if (!(await hasTarget(page, link.href))) problems.push(`anchor ${link.href} has no target`);
      continue;
    }
    if (/^(https?:|mailto:)/.test(link.href)) {
      problems.push(...externalProblem(link));
      continue;
    }
    const path = link.href.split("#")[0] ?? "";
    if (!statuses.has(path)) {
      const { status } = await fetchText(request, path);
      statuses.set(path, status);
    }
    if (statuses.get(path) !== 200) problems.push(`${link.href} → ${statuses.get(path)}`);
  }
  return problems;
}

test("every internal link and anchor resolves", async ({ page, request }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium-desktop", "markup is the same on every project");
  test.setTimeout(180_000);
  const statuses = new Map<string, number>();
  const problems: string[] = [];
  for (const screen of SCREENS) {
    await page.goto(screen.path);
    const found = await problemsOf(page, request, statuses);
    problems.push(...found.map(problem => `${screen.path}: ${problem}`));
  }
  expect(problems).toEqual([]);
  expect(statuses.size).toBeGreaterThan(40);
});
