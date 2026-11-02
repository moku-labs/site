/**
 * @file The build emitted what it should, checked over HTTP against the served `dist/`: every
 * page, every Markdown twin, the agent files, the search index, the data sidecars, the sitemap,
 * the cache headers file, and a real 404 for an unknown path.
 */
import { expect, fetchText, test } from "./_fixtures";
import { DOC_SCREENS, NOT_FOUND_PATH, SCREENS } from "./_inventory";

test.describe.configure({ mode: "parallel" });

test("every page is served as HTML", async ({ request }) => {
  for (const screen of SCREENS.filter(s => !s.static)) {
    const response = await request.get(screen.path);
    expect(response.status(), screen.path).toBe(200);
    expect(response.headers()["content-type"], screen.path).toContain("text/html");
  }
});

test("every page has its Markdown twin", async ({ request }) => {
  for (const screen of SCREENS.filter(s => s.markdown)) {
    const response = await request.get(screen.markdown ?? "");
    expect(response.status(), screen.markdown).toBe(200);
    const text = await response.text();
    expect(text.trim().length, screen.markdown).toBeGreaterThan(40);
    if (screen.doc) expect(text, screen.markdown).toContain(screen.title);
  }
});

test("llms.txt lists every docs page and llms-full.txt carries them", async ({ request }) => {
  const { text: llms } = await fetchText(request, "/llms.txt");
  expect(llms.startsWith("# Moku Labs")).toBe(true);
  for (const screen of DOC_SCREENS)
    expect(llms, screen.path).toContain(`https://moku-labs.com${screen.markdown}`);
  const full = await request.get("/llms-full.txt");
  expect(full.status()).toBe(200);
  const fullText = await full.text();
  for (const screen of DOC_SCREENS) expect(fullText, screen.path).toContain(screen.title);
});

test("the search index has a row for every docs page", async ({ request }) => {
  const response = await request.get("/search/en.json");
  expect(response.status()).toBe(200);
  const rows = (await response.json()) as { href: string; title: string; kind: string }[];
  const hrefs = new Set(rows.map(row => row.href));
  for (const screen of DOC_SCREENS) expect(hrefs.has(screen.path), screen.path).toBe(true);
  for (const row of rows) {
    expect(row.title.length).toBeGreaterThan(0);
    expect(row.href.startsWith("/")).toBe(true);
  }
});

test("data sidecars exist for client navigation", async ({ request }) => {
  for (const path of ["/", "/docs/", "/docs/web/guides/routing/", "/demos/", "/about/"]) {
    const response = await request.get(`/_data${path}index.json`);
    expect(response.status(), path).toBe(200);
  }
});

test("sitemap, robots and cache headers", async ({ request }) => {
  const { text: sitemap } = await fetchText(request, "/sitemap.xml");
  for (const screen of SCREENS.filter(s => !s.static)) {
    const url = `https://moku-labs.com${screen.path === "/" ? "" : screen.path}`;
    expect(sitemap, screen.path).toContain(`<loc>${url}</loc>`);
  }
  const robots = await fetchText(request, "/robots.txt");
  expect(robots.status).toBe(200);
  const headers = await fetchText(request, "/_headers");
  expect(headers.text).toContain("Cache-Control");
});

test("an unknown path answers 404 with the 404 page", async ({ request }) => {
  const response = await request.get(NOT_FOUND_PATH);
  expect(response.status()).toBe(404);
  expect(await response.text()).toContain("404");
});
