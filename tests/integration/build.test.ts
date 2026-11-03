import { spawn } from "node:child_process";
import { cp, mkdtemp, readFile, rm, stat, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { gzipSync } from "node:zlib";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { app } from "../../src/app";
import { SITE } from "../../src/config";
import { searchResults } from "../../src/lib/search-results";
import type { DocumentPage } from "../../src/plugins/docs/types";
import type { SearchEntry, SearchShard } from "../../src/plugins/search/types";

// Slow on purpose: one real `bun scripts/build.ts` (43 pages). It runs in a copy of the project in a
// temp dir, so the build never touches the working `dist/`. Sources are copied, not linked: the
// build's asset copy refuses a symlinked directory. `node_modules` is linked.
// No 404.html test: `app.cli.build()` itself fails without it, so the beforeAll fails first.
const repository = path.resolve(import.meta.dirname, "..", "..");
const copied = ["src", "content", "public", "scripts", "package.json", "tsconfig.json"];
const BUILD_TIMEOUT = 180_000;

/** The budget of `search/en.json`, gzipped: every visitor who opens ⌘K downloads it. */
const SHARD_GZIP_BUDGET = 150 * 1024;

/** The ranking addendum's expected top result per query, on the real docs. */
const EXPECTED_TOP: readonly (readonly [string, (top: SearchEntry) => boolean])[] = [
  ["island", top => top.href === "/docs/web/guides/islands/"],
  ["route", top => ["/docs/web/plugins/router/", "/docs/web/guides/routing/"].includes(top.href)],
  ["plugin", top => top.href === "/docs/concepts/plugins/"],
  ["deploy", top => top.href === "/docs/web/plugins/deploy/"],
  ["fx", top => top.href === "/docs/game/plugins/effects/"],
  ["createApp", top => top.kind === "Section" && top.title === "createApp"],
  ["router", top => top.href === "/docs/web/plugins/router/"],
  ["events", top => top.href === "/docs/concepts/events/"]
];

let project = "";
let pages: DocumentPage[] = [];

/**
 * Run the real build entry in the temp project.
 *
 * @param cwd - The temp project.
 * @returns Resolves on exit code 0.
 * @throws {Error} With the build output on any other exit.
 */
function runBuild(cwd: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn("bun", ["scripts/build.ts"], { cwd });
    let output = "";
    child.stdout.on("data", (chunk: Buffer) => {
      output += chunk.toString();
    });
    child.stderr.on("data", (chunk: Buffer) => {
      output += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", code => {
      if (code === 0) resolve();
      else reject(new Error(`bun scripts/build.ts exited with ${code}:\n${output}`));
    });
  });
}

/**
 * Whether a file exists in the build output.
 *
 * @param relative - Path inside `dist/`, with or without a leading slash.
 * @returns `true` when it is a file.
 */
async function built(relative: string): Promise<boolean> {
  const file = path.join(project, "dist", relative.replace(/^\/+/, ""));
  return stat(file).then(
    info => info.isFile(),
    () => false
  );
}

/**
 * Read a file of the build output.
 *
 * @param relative - Path inside `dist/`, with or without a leading slash.
 * @returns The file text.
 */
function readBuilt(relative: string): Promise<string> {
  return readFile(path.join(project, "dist", relative.replace(/^\/+/, "")), "utf8");
}

/**
 * The `.md` twin a docs page links for Copy as Markdown, read from its built HTML.
 *
 * @param page - A docs page.
 * @returns The URL path of the twin, or `undefined` when the page links none.
 */
async function markdownUrlOf(page: DocumentPage): Promise<string | undefined> {
  const html = await readBuilt(`${page.path}index.html`);
  return /data-markdown-url="([^"]+)"/.exec(html)?.[1];
}

beforeAll(async () => {
  project = await mkdtemp(path.join(tmpdir(), "site-build-"));
  await Promise.all(
    copied.map(name =>
      cp(path.join(repository, name), path.join(project, name), { recursive: true })
    )
  );
  await symlink(path.join(repository, "node_modules"), path.join(project, "node_modules"), "dir");
  const [, all] = await Promise.all([runBuild(project), app.docs.all()]);
  pages = all;
}, BUILD_TIMEOUT);

afterAll(async () => {
  await rm(project, { recursive: true, force: true });
});

describe("bun run build", () => {
  // Bug: a docs route's generate() misses a depth (section pages, package homes), so the
  // sidebar links pages that 404. The page list comes from the docs plugin itself.
  it("writes an index.html for every docs page", async () => {
    expect(pages.length).toBeGreaterThan(0);
    const missing: string[] = [];
    for (const page of pages) {
      if (!(await built(`${page.path}index.html`))) missing.push(page.path);
    }

    expect(missing).toEqual([]);
  });

  // Bug: the llms emitter skips pages (a depth, a package), or a page links a `.md` path the
  // emitter does not write: Copy as Markdown and "View as .md" then 404.
  it("writes the .md twin every docs page links", async () => {
    const broken: string[] = [];
    for (const page of pages) {
      const url = await markdownUrlOf(page);
      if (url === undefined || !(await built(url))) broken.push(`${page.path} -> ${url}`);
    }

    expect(broken).toEqual([]);
  });

  // Bug: a page drops out of the agents' index, or llms.txt links a twin that does not exist;
  // llms-full.txt missing breaks the footer link.
  it("lists every docs page in llms.txt by its .md twin, next to llms-full.txt", async () => {
    const llms = await readBuilt("llms.txt");
    const unlisted: string[] = [];
    for (const page of pages) {
      const url = await markdownUrlOf(page);
      if (!llms.includes(`(${SITE.url}${url})`)) unlisted.push(page.path);
    }

    expect(unlisted).toEqual([]);
    expect(await built("llms-full.txt")).toBe(true);
  });

  // Bug: the search index is built from another page set than the docs plugin's, or not
  // written: the ⌘K palette then cannot find a docs page.
  it("writes the search shard with every docs page", async () => {
    const shard = JSON.parse(await readBuilt("search/en.json")) as SearchShard;
    const hrefs = new Set(shard.entries.map(row => row.href));

    expect(pages.filter(page => !hrefs.has(page.path)).map(page => page.path)).toEqual([]);
  });

  // Bug: another page outranks the effects plugin, or the alias stops resolving on the real docs.
  it("answers fx with the effects plugin on the built shard", async () => {
    const shard = JSON.parse(await readBuilt("search/en.json")) as SearchShard;

    expect(searchResults(shard, "fx", [])[0]?.href).toBe("/docs/game/plugins/effects/");
  });

  // Bug: a section or a far longer word outranks the main page of a topic on the real docs.
  it("puts the main page of a topic first on the built shard", async () => {
    const shard = JSON.parse(await readBuilt("search/en.json")) as SearchShard;
    const wrong = EXPECTED_TOP.flatMap(([query, isExpected]) => {
      const top = searchResults(shard, query, [])[0];
      return top !== undefined && isExpected(top) ? [] : [`${query} -> ${top?.href}`];
    });

    expect(wrong).toEqual([]);
    // Bug: `routing` does not start with `route`, so the Routing guide drops out of the
    // results for `route` unless the alias lists it.
    const routeTop = searchResults(shard, "route", []).slice(0, 3);
    expect(routeTop.map(row => row.href)).toContain("/docs/web/guides/routing/");
  });

  // Bug: the Testing guide falls out of what the palette shows first. A section titled exactly Tests
  // may lead, so the promise is the top 3.
  it("lists a Testing guide in the top 3 for test on the built shard", async () => {
    const shard = JSON.parse(await readBuilt("search/en.json")) as SearchShard;
    const top = searchResults(shard, "test", [], 3);

    expect(top.some(row => row.kind === "Guide" && row.title === "Testing")).toBe(true);
  });

  // Bug: a renamed page or word leaves an alias pointing at nothing, and it dies without a sound.
  it("has every alias target in the terms", async () => {
    const shard = JSON.parse(await readBuilt("search/en.json")) as SearchShard;
    const terms = new Set(shard.terms);
    const dead = Object.entries(shard.aliases).flatMap(([alias, targets]) =>
      targets.filter(target => !terms.has(target)).map(target => `${alias} -> ${target}`)
    );

    expect(dead).toEqual([]);
  });

  // Bug: the docs grow, or noise enters the tables, until the first ⌘K costs a large download.
  it("keeps the gzipped shard inside its budget", async () => {
    const gzipped = gzipSync(await readBuilt("search/en.json")).length;

    expect(gzipped).toBeLessThanOrEqual(SHARD_GZIP_BUDGET);
  });

  // Bug: `feeds: false` is lost from the build config, and the empty article model ships
  // RSS, Atom and JSON feeds the site never meant to publish.
  it("writes no feed files", async () => {
    const feeds = ["rss.xml", "atom.xml", "feed.json"];
    const present = await Promise.all(feeds.map(feed => built(feed)));

    expect(feeds.filter((_, index) => present[index])).toEqual([]);
  });

  // Bug: the home head goes through the `%s — Moku Labs` template, so the tab reads
  // "Moku Labs — Moku Labs".
  it("titles the home page with the site name once", async () => {
    const html = await readBuilt("index.html");

    expect(/<title>([^<]*)<\/title>/.exec(html)?.[1]).toBe(SITE.name);
  });
});
