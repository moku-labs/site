import { spawn } from "node:child_process";
import { cp, mkdtemp, readFile, rm, stat, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { app } from "../../src/app";
import { SITE } from "../../src/config";
import type { DocumentPage } from "../../src/plugins/docs/types";

// Slow on purpose: one real `bun scripts/build.ts` (43 pages, about 2-5 s). It runs in a copy of
// the project in a temp dir, so the build never touches the working `dist/`. Sources are copied,
// not linked: the build's asset copy refuses a symlinked directory. `node_modules` is linked.
// No 404.html test: `app.cli.build()` itself fails without it, so the beforeAll fails first.
const repository = path.resolve(import.meta.dirname, "..", "..");
const copied = ["src", "content", "public", "scripts", "package.json", "tsconfig.json"];
const BUILD_TIMEOUT = 180_000;

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
    const rows = JSON.parse(await readBuilt("search/en.json")) as { href: string }[];
    const hrefs = new Set(rows.map(row => row.href));

    expect(pages.filter(page => !hrefs.has(page.path)).map(page => page.path)).toEqual([]);
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
