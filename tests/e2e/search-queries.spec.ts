/**
 * @file The ⌘K query in a real browser on the real shard: every Verification line of the
 * client-search delta spec, the Ranking and Size addenda, the alias table, illegal input, the load
 * states, keyboard, history and where a result lands. `search.spec.ts` holds the first pass of the
 * palette; these derive their expectations from the docs corpus, read with a tiny parser, and never
 * from the index under test.
 */
import { existsSync, readFileSync } from "node:fs";
import nodePath from "node:path";
import { gzipSync } from "node:zlib";
import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { searchAliases } from "../../src/data/search-aliases";
import { searchResults } from "../../src/lib/search-results";
import type { SearchShard } from "../../src/plugins/search/types";
import { boot, expect, isPhone, press, test } from "./_fixtures";
import { DOC_SCREENS, RICH_DOC } from "./_inventory";

const DOCS_DIR = nodePath.join(import.meta.dirname, "../../content/docs");

const palette = (page: Page) => page.locator('[data-island="search-palette"]');
const input = (page: Page) => palette(page).getByRole("combobox", { name: "Search docs" });
const options = (page: Page) => palette(page).getByRole("option");
const status = (page: Page) => palette(page).locator('[data-part="status"]');
const opener = (page: Page) => page.locator('[data-component="site-header"] [data-part="search"]');
const header = (page: Page) => page.locator('[data-component="site-header"]');

/** One result row as the visitor reads it. */
type Row = {
  /** Link target. */
  href: string;
  /** Visible title. */
  title: string;
  /** Visible kind: Plugin, Section and so on. */
  kind: string;
  /** The marked text in the row. */
  marks: string[];
};

/**
 * Wait until a scheduled paint has run: the palette paints on the next frame.
 *
 * @param page - The page.
 */
async function nextPaint(page: Page) {
  await page.evaluate(
    () =>
      new Promise<void>(resolve => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      })
  );
}

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
 * Type a query and return the rows it paints.
 *
 * @param page - The page.
 * @param query - The query.
 * @returns The rows on screen.
 */
async function ask(page: Page, query: string): Promise<Row[]> {
  await input(page).fill(query);
  await nextPaint(page);
  return options(page).evaluateAll(all =>
    all.map(option => ({
      href: option.getAttribute("href") ?? "",
      title: option.querySelector('[data-part="title"]')?.textContent ?? "",
      kind: option.querySelector('[data-part="kind"]')?.textContent ?? "",
      marks: [...option.querySelectorAll("mark")].map(mark => mark.textContent ?? "")
    }))
  );
}

/**
 * The Markdown of a docs page.
 *
 * @param path - Page path, with or without a fragment.
 * @returns The file's text.
 */
function pageSource(path: string): string {
  const relative = (path.split("#")[0] ?? "").replace(/^\/docs\//, "").replace(/\/$/, "");
  const base = nodePath.join(DOCS_DIR, relative);
  const file = existsSync(`${base}.md`) ? `${base}.md` : nodePath.join(base, "index.md");
  return readFileSync(file, "utf8");
}

/**
 * Split a Markdown file into what is inside its code fences and what is outside them.
 *
 * @param source - The file's text.
 * @returns The two halves.
 */
function fences(source: string): { code: string; prose: string } {
  const code: string[] = [];
  const prose: string[] = [];
  let inside = false;
  for (const line of source.split("\n")) {
    if (/^\s*(```|~~~)/.test(line)) inside = !inside;
    else (inside ? code : prose).push(line);
  }
  return { code: code.join("\n"), prose: prose.join("\n") };
}

/**
 * Whether a Markdown line is an h2 or an h3.
 *
 * @param line - The line.
 * @returns `true` for a heading.
 */
function isHeading(line: string): boolean {
  return /^#{2,3} /.test(line);
}

/**
 * The text a result row answers for: its section, or the whole page for a page row.
 *
 * @param row - The row.
 * @returns The Markdown it covers.
 */
function rowText(row: Row): string {
  const source = pageSource(row.href);
  if (row.kind !== "Section") return source;
  const lines = source.split("\n");
  const start = lines.findIndex(
    line => isHeading(line) && line.replace(/^#+ /, "").replaceAll("`", "") === row.title
  );
  const end = lines.findIndex((line, index) => index > start && isHeading(line));
  return lines.slice(start, end === -1 ? undefined : end).join("\n");
}

/**
 * Where a heading sits under the sticky header.
 *
 * @param page - The page.
 * @param id - The heading's id.
 * @returns The distance from the header's bottom edge, px.
 */
async function distanceUnderHeader(page: Page, id: string): Promise<number> {
  const top = await page
    .locator(`[data-content] [id="${id}"]`)
    .evaluate(element => element.getBoundingClientRect().top);
  const bottom = await header(page).evaluate(element => element.getBoundingClientRect().bottom);
  return top - bottom;
}

/**
 * Hold the shard until a promise settles.
 *
 * @param page - The page.
 * @returns The function that lets the file through.
 */
async function holdShard(page: Page): Promise<() => void> {
  const held = Promise.withResolvers<void>();
  await page.route("**/search/en.json", async route => {
    await held.promise;
    await route.continue();
  });
  return () => held.resolve();
}

/**
 * What is wrong with one term's postings.
 *
 * @param term - The term.
 * @param posting - Its flat `[entryDelta, weight, ...]`.
 * @param rowCount - How many rows the shard has.
 * @returns One line per problem.
 */
function postingProblems(term: string, posting: readonly number[], rowCount: number): string[] {
  const broken: string[] = [];
  let entry = -1;
  let bodyOnly = 0;
  for (let at = 0; at < posting.length; at += 2) {
    const delta = posting[at] ?? 0;
    entry = at === 0 ? delta : entry + delta;
    if (at > 0 && delta < 1) broken.push(`${term}: indices do not ascend`);
    if (entry >= rowCount) broken.push(`${term}: index ${entry} past the rows`);
    if (posting[at + 1] === 1) bodyOnly += 1;
  }
  return bodyOnly > 60 ? [...broken, `${term}: ${bodyOnly} body postings`] : broken;
}

test.describe("verification", () => {
  // Bug: a prefix or a typo finds nothing, or the typo gets a mark on letters that do not match.
  test("eff finds the effects plugin by prefix, efects by typo with no mark", async ({
    page
  }, testInfo) => {
    await boot(page, "/");
    await openPalette(page, isPhone(testInfo.project.name));
    const prefix = await ask(page, "eff");
    expect(prefix[0]?.href).toBe("/docs/game/plugins/effects/");
    expect(prefix[0]?.marks.join("").toLowerCase()).toBe("eff");
    const typo = await ask(page, "efects");
    expect(typo[0]?.href).toBe("/docs/game/plugins/effects/");
    expect(typo[0]?.marks).toEqual([]);
  });

  // Bug: code fences are not indexed, so an API name is found only where prose repeats it.
  test("a name that lives only in a code block finds its section", async ({ page }, testInfo) => {
    const word = "createCmsApi";
    const everyPage = DOC_SCREENS.map(screen => fences(pageSource(screen.path)));
    expect(everyPage.filter(page_ => page_.prose.includes(word))).toEqual([]);
    expect(fences(pageSource("/docs/core/api/")).code).toContain(word);
    await boot(page, "/");
    await openPalette(page, isPhone(testInfo.project.name));
    const found = await ask(page, word);
    expect(found[0]?.href).toBe("/docs/core/api/#types");
  });

  // Bug: the code of a page is not indexed, so `createApp` reaches only pages whose prose has it.
  test("createApp reaches a page where it appears only in a code block", async ({ request }) => {
    const codeOnly = DOC_SCREENS.map(screen => screen.path).filter(path => {
      const { code, prose } = fences(pageSource(path));
      return code.includes("createApp") && !prose.includes("createApp");
    });
    expect(codeOnly.length).toBeGreaterThan(0);
    const response = await request.get("/search/en.json");
    const shard = (await response.json()) as SearchShard;
    const all = searchResults(shard, "createApp", [], Number.MAX_SAFE_INTEGER);
    const reached = all.filter(row => codeOnly.includes(row.href.split("#")[0] ?? ""));
    expect(reached.length).toBeGreaterThan(0);
  });

  // Bug: h3 headings are left out of the index, so a word only they hold cannot be found.
  for (const [word, path, id] of [
    ["schemas", "/docs/room/plugins/intent/", "schemas"],
    ["entitlements", "/docs/ai/plugins/ark/", "keys-and-entitlements"]
  ] as const) {
    test(`${word}, only in an h3 of its page, opens that heading's anchor`, async ({
      page
    }, testInfo) => {
      const phone = isPhone(testInfo.project.name);
      const hits = pageSource(path)
        .split("\n")
        .filter(line => line.toLowerCase().includes(word));
      expect(hits).toHaveLength(1);
      expect(hits[0]).toMatch(/^### /);
      await boot(page, "/");
      await openPalette(page, phone);
      const found = await ask(page, word);
      expect(found[0]?.href).toBe(`${path}#${id}`);
      expect(found[0]?.kind).toBe("Section");
      await press(options(page).first(), phone);
      await expect(palette(page)).toBeHidden();
      await expect(page).toHaveURL(new RegExp(`${path}#${id}$`));
      const heading = page.locator(`[data-content] h3[id="${id}"]`);
      await expect(heading).toBeInViewport();
      const below = await distanceUnderHeader(page, id);
      expect(below).toBeGreaterThanOrEqual(0);
      expect(below).toBeLessThanOrEqual(40);
      // Bug: the fragment in the path matches no route, so the header loses its marked link.
      if (!phone) {
        await expect(page.locator('#site-menu a[data-nav="docs"]')).toHaveAttribute(
          "aria-current",
          "page"
        );
      }
      await page.goBack();
      await expect(page).toHaveURL(url => url.pathname === "/" && url.hash === "");
    });
  }

  // Bug: several words widen the results (any word) instead of narrowing them (every word).
  test("route head lists only rows that hold both words", async ({ page }, testInfo) => {
    await boot(page, "/");
    await openPalette(page, isPhone(testInfo.project.name));
    const found = await ask(page, "route head");
    expect(found.length).toBeGreaterThan(0);
    for (const row of found) {
      const text = rowText(row);
      expect(text, row.href).toMatch(/rout/i);
      expect(text, row.href).toMatch(/head/i);
    }
    const alone = await ask(page, "zzqxv head");
    expect(alone).toEqual([]);
  });

  // Bug: a page's body text outranks the page whose title is the word.
  for (const [word, title, href] of [
    ["rulesets", "Rulesets", "/docs/ci/rulesets/"],
    ["profiles", "Build profiles", "/docs/native/guides/profiles/"]
  ] as const) {
    test(`a title match on ${word} ranks above body matches of the same word`, async ({
      page
    }, testInfo) => {
      await boot(page, "/");
      await openPalette(page, isPhone(testInfo.project.name));
      const found = await ask(page, word);
      expect(found[0]?.title).toBe(title);
      expect(found[0]?.href).toBe(href);
      const below = found.slice(1);
      expect(below.length).toBeGreaterThan(1);
      for (const row of below) expect(row.title.toLowerCase(), row.href).not.toContain(word);
    });
  }

  // Bug: an empty or blank query shows nothing, or the suggestions in another order.
  test("an empty or blank query lists the suggested pages in their order", async ({
    page
  }, testInfo) => {
    await boot(page, "/");
    await openPalette(page, isPhone(testInfo.project.name));
    const suggested = [
      "/docs/web/quick-start/",
      "/docs/web/guides/routing/",
      "/docs/web/plugins/content/",
      "/docs/concepts/kernel-checks/",
      "/docs/web/guides/islands/"
    ];
    const hrefs = async (query: string) => {
      const found = await ask(page, query);
      return found.map(row => row.href);
    };
    expect(await hrefs("")).toEqual(suggested);
    await expect(palette(page).locator('[data-part="label"]')).toBeVisible();
    expect(await hrefs("   ")).toEqual(suggested);
    await ask(page, "fx");
    await expect(palette(page).locator('[data-part="label"]')).toBeHidden();
    expect(await hrefs("")).toEqual(suggested);
    await expect(status(page)).toHaveText("");
  });

  // Bug: a nonsense query leaves stale rows, an empty panel, or an Enter that opens the old pick.
  test("a nonsense query lists nothing, the status says so, and Enter stays put", async ({
    page
  }, testInfo) => {
    await boot(page, "/docs/");
    await openPalette(page, isPhone(testInfo.project.name));
    expect(await ask(page, "zzqxv")).toEqual([]);
    await expect(palette(page).getByRole("status")).toHaveText(/^Nothing matches "zzqxv"\./);
    await expect(input(page)).not.toHaveAttribute("aria-activedescendant", /.*/);
    await input(page).press("Enter");
    await expect(palette(page)).toBeVisible();
    await expect(page).toHaveURL(/\/docs\/#search$/);
    const found = await ask(page, "fx");
    expect(found.length).toBeGreaterThan(0);
    await expect(status(page)).toHaveText("");
  });
});

test.describe("ranking", () => {
  /** The Ranking addendum's expected top rows on the real shard. */
  const TOPS: readonly (readonly [string, (row: Row) => boolean])[] = [
    ["island", row => row.href === "/docs/web/guides/islands/"],
    ["route", row => ["/docs/web/plugins/router/", "/docs/web/guides/routing/"].includes(row.href)],
    ["plugin", row => row.href === "/docs/concepts/plugins/"],
    ["deploy", row => row.href === "/docs/web/plugins/deploy/"],
    ["fx", row => row.href === "/docs/game/plugins/effects/"],
    ["createApp", row => row.kind === "Section" && row.title === "createApp"],
    ["router", row => row.href === "/docs/web/plugins/router/"],
    ["events", row => row.href === "/docs/concepts/events/"]
  ];

  // Bug: a section outranks the main page of a topic on the real docs, in the palette itself.
  test("the palette puts the main page of a topic first", async ({ page }, testInfo) => {
    await boot(page, "/");
    await openPalette(page, isPhone(testInfo.project.name));
    for (const [query, isExpected] of TOPS) {
      const [top] = await ask(page, query);
      expect(top && isExpected(top), `${query} -> ${top?.href}`).toBe(true);
    }
    const testing = await ask(page, "test");
    expect(testing.slice(0, 3).some(row => row.kind === "Guide" && row.title === "Testing")).toBe(
      true
    );
  });

  // Bug: the query keeps its case or its spaces, so `FX` or `  fx  ` finds nothing.
  test("case and spaces do not change the results", async ({ page }, testInfo) => {
    await boot(page, "/");
    await openPalette(page, isPhone(testInfo.project.name));
    const expected = await ask(page, "fx");
    expect(await ask(page, "FX")).toEqual(expected);
    expect(await ask(page, "  fx  ")).toEqual(expected);
  });

  // Bug: an alias of the table dies when a page is renamed: the palette answers with nothing.
  test("every alias lists results, and marks its target in a title", async ({ page }, testInfo) => {
    await boot(page, "/");
    await openPalette(page, isPhone(testInfo.project.name));
    for (const [alias, targets] of Object.entries(searchAliases)) {
      const found = await ask(page, alias);
      expect(found.length, alias).toBeGreaterThan(0);
      const words = [alias, ...targets];
      const marked = found.flatMap(row => row.marks).map(mark => mark.toLowerCase());
      expect(
        marked.some(mark => words.some(word => mark.includes(word))),
        `${alias} marks ${marked.join(", ")}`
      ).toBe(true);
    }
  });

  // Bug: a camelCase query marks its parts one by one, or nothing at all.
  test("createApp is marked as one word", async ({ page }, testInfo) => {
    await boot(page, "/");
    await openPalette(page, isPhone(testInfo.project.name));
    const found = await ask(page, "createApp");
    expect(found[0]?.marks[0]).toBe("createApp");
  });
});

test.describe("size addendum", () => {
  test("the served shard: budget, sorted terms, delta postings, at most 60 body postings", async ({
    request
  }, testInfo) => {
    test.skip(testInfo.project.name !== "chromium-desktop", "one file, one check");
    const response = await request.get("/search/en.json");
    expect(gzipSync(await response.body()).length).toBeLessThanOrEqual(150_000);
    const shard = (await response.json()) as SearchShard;
    expect(shard.postings).toHaveLength(shard.terms.length);
    expect(shard.terms).toEqual(shard.terms.toSorted());
    const broken = shard.terms.flatMap((term, index) =>
      postingProblems(term, shard.postings[index] ?? [], shard.entries.length)
    );
    expect(broken).toEqual([]);
  });
});

test.describe("illegal input", () => {
  // Bug: a query reaches the DOM as markup, or an object key like `__proto__` crashes the lookup.
  test("markup, object keys, symbols and huge input cause no error and no markup", async ({
    page
  }, testInfo) => {
    await boot(page, "/");
    await openPalette(page, isPhone(testInfo.project.name));
    const hostile = '<img src=x onerror="document.title=1">';
    for (const query of [
      hostile,
      "constructor",
      "__proto__",
      "toString",
      ".",
      "\\",
      "(",
      "[a-z]+",
      "日本語",
      "🙂",
      "a",
      "x".repeat(5000)
    ]) {
      await ask(page, query);
      await expect(input(page)).toBeVisible();
    }
    await ask(page, `zzqxv${hostile}`);
    await expect(palette(page).locator('img[src="x"]')).toHaveCount(0);
    expect(await page.title()).not.toBe("1");
  });
});

test.describe("keyboard", () => {
  test("arrows wrap at both ends, typing resets the pick to the first row", async ({
    page
  }, testInfo) => {
    await boot(page, "/");
    await openPalette(page, isPhone(testInfo.project.name));
    const { length: count } = await ask(page, "effects");
    expect(count).toBeGreaterThan(2);
    await input(page).press("ArrowUp");
    await expect(options(page).nth(count - 1)).toHaveAttribute("aria-selected", "true");
    await expect(options(page).nth(count - 1)).toBeInViewport();
    const last = await options(page)
      .nth(count - 1)
      .getAttribute("id");
    await expect(input(page)).toHaveAttribute("aria-activedescendant", last ?? "");
    await input(page).press("ArrowDown");
    await expect(options(page).first()).toHaveAttribute("aria-selected", "true");
    await input(page).press("ArrowDown");
    await expect(options(page).nth(1)).toHaveAttribute("aria-selected", "true");
    await ask(page, "effect");
    await expect(options(page).first()).toHaveAttribute("aria-selected", "true");
    await expect(options(page).nth(1)).toHaveAttribute("aria-selected", "false");
  });

  // Bug: Tab walks out of the modal into the page under it.
  test("Tab and Shift+Tab stay on the input", async ({ page }, testInfo) => {
    test.skip(isPhone(testInfo.project.name), "a hardware keyboard");
    await boot(page, "/");
    await openPalette(page, false);
    await page.keyboard.press("Tab");
    await expect(input(page)).toBeFocused();
    await page.keyboard.press("Shift+Tab");
    await expect(input(page)).toBeFocused();
  });

  // Bug: the query of the last visit is still in the input when the palette opens again.
  test("closing empties the query; the next open shows the suggestions", async ({
    page
  }, testInfo) => {
    const phone = isPhone(testInfo.project.name);
    await boot(page, "/");
    await openPalette(page, phone);
    await ask(page, "effects");
    await page.keyboard.press("Escape");
    await expect(palette(page)).toBeHidden();
    await press(opener(page), phone);
    await expect(input(page)).toHaveValue("");
    await expect(palette(page).locator('[data-part="label"]')).toBeVisible();
    await expect(options(page)).toHaveCount(5);
  });

  // Bug: the history pop of Esc lands after the shortcut reopens the palette, and closes it again.
  test("Esc straight into the shortcut leaves the palette open, and Esc still closes it", async ({
    page
  }, testInfo) => {
    test.skip(isPhone(testInfo.project.name), "a hardware keyboard");
    await boot(page, "/docs/");
    await page.keyboard.press("ControlOrMeta+k");
    await expect(palette(page)).toBeVisible();
    await page.evaluate(() => {
      const field = document.querySelector('[data-part="field"] input');
      const key = (init: KeyboardEventInit) =>
        field?.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, ...init }));
      key({ key: "Escape" });
      key({ key: "k", ctrlKey: true });
    });
    await page.waitForTimeout(300);
    await expect(palette(page)).toBeVisible();
    await expect(input(page)).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(palette(page)).toBeHidden();
    await expect.poll(() => new URL(page.url()).hash).toBe("");
  });
});

test.describe("history and landing", () => {
  // Bug: the palette's own entry stays under the result, so Back reopens or stays on the page.
  test("Back from a chosen result returns to the page the palette opened on", async ({
    page
  }, testInfo) => {
    await boot(page, "/docs/");
    await openPalette(page, isPhone(testInfo.project.name));
    await ask(page, "fx");
    await input(page).press("Enter");
    await expect(page).toHaveURL(/\/docs\/game\/plugins\/effects\/$/);
    await expect(page.locator("h1").first()).toContainText(/effects/i);
    await page.goBack();
    await expect(page).toHaveURL(url => url.pathname === "/docs/" && url.hash === "");
    await expect(palette(page)).toBeHidden();
    await expect(page.locator("h1").first()).toHaveText("Docs");
  });

  // Bug: a section of the page you are on does nothing: the router sees the same path.
  test("a section of the current page scrolls to it and closes the palette", async ({
    page
  }, testInfo) => {
    const phone = isPhone(testInfo.project.name);
    await boot(page, "/docs/ai/plugins/ark/");
    await openPalette(page, phone);
    await ask(page, "entitlements");
    await press(options(page).first(), phone);
    await expect(palette(page)).toBeHidden();
    await expect(page).toHaveURL(/\/docs\/ai\/plugins\/ark\/#keys-and-entitlements$/);
    await expect(page.locator('[data-content] [id="keys-and-entitlements"]')).toBeInViewport();
    const below = await distanceUnderHeader(page, "keys-and-entitlements");
    expect(below).toBeGreaterThanOrEqual(0);
    expect(below).toBeLessThanOrEqual(40);
  });

  // Bug: the row of the current page keeps the palette's `#search` on the URL and its history entry.
  test("the row of the current page closes the palette and leaves no entry behind", async ({
    page
  }, testInfo) => {
    const phone = isPhone(testInfo.project.name);
    await boot(page, "/");
    await press(page.locator('main a[href="/docs/"]').first(), phone);
    await expect(page).toHaveURL(/\/docs\/$/);
    await press(page.locator('main a[href="/docs/web/"]').first(), phone);
    await expect(page).toHaveURL(/\/docs\/web\/$/);
    await openPalette(page, phone);
    const found = await ask(page, "@moku-labs/web");
    expect(found[0]?.href).toBe("/docs/web/");
    await press(options(page).first(), phone);
    await expect(palette(page)).toBeHidden();
    await expect(page).toHaveURL(url => url.pathname === "/docs/web/" && url.hash === "");
    await page.goBack();
    await expect(page).toHaveURL(url => url.pathname === "/docs/");
  });

  // Bug: the hash push jumps the page, or closing leaves it somewhere else.
  test("opening and closing keeps the scroll position and the page's own anchor", async ({
    page
  }) => {
    await boot(page, `${RICH_DOC}#links`);
    await expect(page.locator("#links")).toBeInViewport();
    const before = await page.evaluate(() => scrollY);
    expect(before).toBeGreaterThan(0);
    await page.keyboard.press("ControlOrMeta+k");
    await expect(palette(page)).toBeVisible();
    await expect(page).toHaveURL(/#search$/);
    expect(await page.evaluate(() => scrollY)).toBe(before);
    await page.keyboard.press("Escape");
    await expect(palette(page)).toBeHidden();
    await expect(page).toHaveURL(/#links$/);
    expect(await page.evaluate(() => scrollY)).toBe(before);
  });

  // Bug: a shared or reloaded `#search` URL opens a dead palette, or a palette that cannot close.
  test("a #search URL loads the page closed; the palette opens and closes there", async ({
    page
  }, testInfo) => {
    const phone = isPhone(testInfo.project.name);
    await boot(page, "/docs/#search");
    await expect(palette(page)).toBeHidden();
    await openPalette(page, phone);
    await page.keyboard.press("Escape");
    await expect(palette(page)).toBeHidden();
    await openPalette(page, phone);
    await expect(input(page)).toBeFocused();
  });

  // Bug: a modifier click is taken over by the SPA, or leaves the palette open behind the new tab.
  test("a Cmd or Ctrl click opens a new tab and closes the palette", async ({
    page,
    context
  }, testInfo) => {
    test.skip(isPhone(testInfo.project.name), "a keyboard modifier");
    await boot(page, "/docs/");
    await openPalette(page, false);
    await ask(page, "fx");
    const popup = context.waitForEvent("page");
    await options(page)
      .first()
      .click({ modifiers: ["ControlOrMeta"] });
    const tab = await popup;
    await tab.waitForLoadState("domcontentloaded");
    expect(new URL(tab.url()).pathname).toBe("/docs/game/plugins/effects/");
    await tab.close();
    await expect(palette(page)).toBeHidden();
    await expect(page).toHaveURL(url => url.pathname === "/docs/" && url.hash === "");
  });
});

test.describe("loading", () => {
  // Bug: a query typed before the file arrives is dropped: the rows are the suggestions, or none.
  test("a query typed during the load gets its results when the file arrives", async ({
    page
  }, testInfo) => {
    const phone = isPhone(testInfo.project.name);
    const release = await holdShard(page);
    await boot(page, "/");
    await press(opener(page), phone);
    await expect(palette(page).getByRole("status")).toHaveText("Loading the index…");
    await expect(palette(page).locator('[data-part="label"]')).toBeHidden();
    await input(page).fill("fx");
    await input(page).press("Enter");
    await expect(palette(page)).toBeVisible();
    await expect(options(page)).toHaveCount(0);
    await expect(palette(page).getByRole("status")).toHaveText("Loading the index…");
    release();
    await expect(options(page).first()).toHaveAttribute("href", "/docs/game/plugins/effects/");
    await expect(status(page)).toHaveText("");
  });

  // Bug: the palette closed during the load paints or reopens itself when the file arrives.
  test("closed during the load it stays closed; the next open needs no second fetch", async ({
    page
  }, testInfo) => {
    const phone = isPhone(testInfo.project.name);
    let fetched = 0;
    page.on("request", request => {
      if (request.url().endsWith("/search/en.json")) fetched += 1;
    });
    const release = await holdShard(page);
    await boot(page, "/");
    await press(opener(page), phone);
    await expect(palette(page)).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(palette(page)).toBeHidden();
    const loaded = page.waitForResponse("**/search/en.json");
    release();
    await loaded;
    await nextPaint(page);
    await expect(palette(page)).toBeHidden();
    await openPalette(page, phone);
    await expect(options(page)).toHaveCount(5);
    expect(fetched).toBe(1);
  });

  // Bug: a cached file of the old format (a bare array) or a broken file is taken for an index.
  for (const [name, body] of [
    ["the old format", "[]"],
    ["broken JSON", "<html>not json"]
  ] as const) {
    test(`${name} ends in the failed status, and the next open retries`, async ({
      page
    }, testInfo) => {
      const phone = isPhone(testInfo.project.name);
      await page.route("**/search/en.json", route =>
        route.fulfill({ status: 200, contentType: "application/json", body })
      );
      await boot(page, "/");
      await press(opener(page), phone);
      await expect(palette(page).getByRole("status")).toHaveText(/did not load/);
      await expect(options(page)).toHaveCount(0);
      await page.unroute("**/search/en.json");
      await page.keyboard.press("Escape");
      await expect(palette(page)).toBeHidden();
      await openPalette(page, phone);
      await expect(status(page)).toHaveText("");
    });
  }

  // Bug: a keyboard visitor waits for the network: focus does not start the load.
  test("focus on the button loads the index, once", async ({ page }, testInfo) => {
    test.skip(isPhone(testInfo.project.name), "no focus without a keyboard");
    let fetched = 0;
    page.on("request", request => {
      if (request.url().endsWith("/search/en.json")) fetched += 1;
    });
    await boot(page, "/");
    await opener(page).focus();
    await expect.poll(() => fetched).toBe(1);
    await page.keyboard.press("Enter");
    await expect(options(page).first()).toBeVisible();
    expect(fetched).toBe(1);
  });

  // Bug: the SPA swap loses the loaded index, so every page fetches the large file again.
  test("the index survives a client navigation", async ({ page }, testInfo) => {
    const phone = isPhone(testInfo.project.name);
    let fetched = 0;
    page.on("request", request => {
      if (request.url().endsWith("/search/en.json")) fetched += 1;
    });
    await boot(page, "/");
    await openPalette(page, phone);
    await ask(page, "fx");
    await input(page).press("Enter");
    await expect(page).toHaveURL(/\/effects\/$/);
    await openPalette(page, phone);
    await ask(page, "routing");
    await input(page).press("Enter");
    await expect(page).toHaveURL(/\/routing\/$/);
    expect(fetched).toBe(1);
  });
});

// Safari before 26.2 has no Navigation API, so the framework runs its history fallback there. WebKit
// is not installed in this run: this is the fallback's logic on Chromium, not Safari's rendering.
test.describe("without the Navigation API", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(globalThis, "navigation", { value: undefined, configurable: true });
    });
  });

  test("a section result lands on its heading, and Back returns to the page before", async ({
    page
  }, testInfo) => {
    const phone = isPhone(testInfo.project.name);
    await boot(page, "/docs/");
    await openPalette(page, phone);
    await ask(page, "entitlements");
    await press(options(page).first(), phone);
    await expect(palette(page)).toBeHidden();
    await expect(page).toHaveURL(/\/docs\/ai\/plugins\/ark\/#keys-and-entitlements$/);
    await expect(page.locator('[data-content] [id="keys-and-entitlements"]')).toBeInViewport();
    await page.goBack();
    await expect(page).toHaveURL(url => url.pathname === "/docs/" && url.hash === "");
    await expect(page.locator("h1").first()).toHaveText("Docs");
  });

  test("Esc pops the palette's entry, Back closes it, and the query still answers", async ({
    page
  }, testInfo) => {
    const phone = isPhone(testInfo.project.name);
    await boot(page, "/");
    await press(page.locator('main a[href="/docs/"]').first(), phone);
    await expect(page).toHaveURL(/\/docs\/$/);
    await openPalette(page, phone);
    await page.keyboard.press("Escape");
    await expect(palette(page)).toBeHidden();
    await expect.poll(() => new URL(page.url()).hash).toBe("");
    await openPalette(page, phone);
    const found = await ask(page, "fx");
    expect(found[0]?.href).toBe("/docs/game/plugins/effects/");
    await page.goBack();
    await expect(palette(page)).toBeHidden();
    await expect(page).toHaveURL(url => url.pathname === "/docs/" && url.hash === "");
    await page.goBack();
    await expect(page).toHaveURL(url => url.pathname === "/");
  });

  // Open finding in `@moku-labs/web`, reported and not fixed here: the history fallback pushes the
  // URL without its fragment, so a plain link to `/#packages` lands at the top with no hash. Drop the
  // fixme with the framework's fix.
  test.fixme("the header's Packages link lands on the packages from another page", async ({
    page
  }, testInfo) => {
    const phone = isPhone(testInfo.project.name);
    await boot(page, "/docs/");
    if (phone) await press(page.locator('[data-part="burger"]'), true);
    await press(page.locator('#site-menu a[data-nav="packages"]'), phone);
    await expect(page).toHaveURL(url => url.pathname === "/" && url.hash === "#packages");
    await expect(page.locator("#packages")).toBeInViewport();
  });
});

test.describe("phone", () => {
  // Bug: iOS zooms the page when the focused input's text is under 16px (the delta spec's iOS line:
  // Safari itself is checked by hand; this guards the size the zoom depends on).
  test("the input's text is at least 16px and the viewport allows zoom", async ({
    page
  }, testInfo) => {
    const phone = isPhone(testInfo.project.name);
    await boot(page, "/");
    await openPalette(page, phone);
    const size = await input(page).evaluate(element =>
      Number.parseFloat(getComputedStyle(element).fontSize)
    );
    expect(size).toBeGreaterThanOrEqual(16);
    await expect(page.locator('meta[name="viewport"]')).not.toHaveAttribute(
      "content",
      /maximum-scale|user-scalable/
    );
    expect(await page.evaluate(() => visualViewport?.scale)).toBe(1);
  });

  // Bug: a long title or subtitle pushes the row past the panel, or the panel past the screen.
  test("panel and rows fit at 320, 390 and 430, with tall enough rows", async ({
    page
  }, testInfo) => {
    test.skip(!isPhone(testInfo.project.name), "phone widths");
    await boot(page, "/");
    await openPalette(page, true);
    for (const width of [320, 390, 430]) {
      await page.setViewportSize({ width, height: 700 });
      await ask(page, "plugin");
      const panel = await palette(page).locator('[data-part="panel"]').boundingBox();
      if (panel === null) throw new Error("the panel has no box");
      expect(panel.x, `${width}px`).toBeGreaterThanOrEqual(0);
      expect(panel.x + panel.width, `${width}px`).toBeLessThanOrEqual(width);
      expect(panel.y + panel.height, `${width}px`).toBeLessThanOrEqual(700);
      const shown = await options(page).evaluateAll(all =>
        all.map(option => {
          const { right, height } = option.getBoundingClientRect();
          return { name: option.textContent ?? "", right, height };
        })
      );
      const problems = shown.flatMap(row => [
        ...(row.right > panel.x + panel.width + 0.5 ? [`past the panel: ${row.name}`] : []),
        ...(row.height < 44 ? [`${row.height}px tall: ${row.name}`] : [])
      ]);
      expect(problems, `${width}px`).toEqual([]);
    }
  });

  test("a tap on the backdrop closes the palette", async ({ page }, testInfo) => {
    test.skip(!isPhone(testInfo.project.name), "touch");
    await boot(page, "/");
    await openPalette(page, true);
    await page.touchscreen.tap(195, 20);
    await expect(palette(page)).toBeHidden();
  });
});

test.describe("accessibility", () => {
  // Bug: a mark or a muted row fails contrast in the light theme; the a11y scan runs dark only.
  test("the open palette passes axe in the light theme, with results and with none", async ({
    page
  }, testInfo) => {
    await boot(page, "/?theme=light");
    await openPalette(page, isPhone(testInfo.project.name));
    const scan = async () => {
      const { violations } = await new AxeBuilder({ page })
        .include('[data-component="search-palette"]')
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .analyze();
      return violations.map(violation => violation.id);
    };
    expect(await scan()).toEqual([]);
    await ask(page, "fx");
    expect(await scan()).toEqual([]);
    await ask(page, "zzqxv");
    expect(await scan()).toEqual([]);
  });

  // Bug: the input points at a list or an option that is not there.
  test("the combobox points at its list and its selected option", async ({ page }, testInfo) => {
    await boot(page, "/");
    await openPalette(page, isPhone(testInfo.project.name));
    await ask(page, "fx");
    const list = await input(page).getAttribute("aria-controls");
    await expect(palette(page).getByRole("listbox", { name: "Results" })).toHaveAttribute(
      "id",
      list ?? ""
    );
    const active = await input(page).getAttribute("aria-activedescendant");
    await expect(options(page).first()).toHaveAttribute("id", active ?? "");
    await expect(
      palette(page).locator('[role="option"][aria-selected="true"]'),
      "one option is selected"
    ).toHaveCount(1);
  });
});
