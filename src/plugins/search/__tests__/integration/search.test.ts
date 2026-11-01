import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildPlugin,
  collectionPlugin,
  contentPlugin,
  createApp,
  createPlugin,
  fileSystemContent
} from "@moku-labs/web";
import { afterEach, describe, expect, expectTypeOf, it, vi } from "vitest";
import { SITE } from "../../../../config";
import { docsPlugin } from "../../../docs";
import { searchPlugin } from "../..";
import type { SearchEntry } from "../../types";

// The fixture tree uses these two packages; both are installed, so their versions resolve for real.
vi.mock("../../../../data/packages", () => ({
  packages: [
    {
      id: "core",
      name: "@moku-labs/core",
      npm: "@moku-labs/core",
      tagline: "The kernel.",
      group: "Core"
    },
    {
      id: "web",
      name: "@moku-labs/web",
      npm: "@moku-labs/web",
      tagline: "Web.",
      group: "Frameworks"
    }
  ]
}));

const fixture = (name: string): string =>
  fileURLToPath(new URL(`../../../docs/__tests__/fixtures/${name}`, import.meta.url));

const directories: string[] = [];
const temporaryDirectory = (): string => {
  const directory = mkdtempSync(path.join(tmpdir(), "site-search-"));
  directories.push(directory);
  return directory;
};
afterEach(() => {
  for (const directory of directories.splice(0))
    rmSync(directory, { recursive: true, force: true });
});

// Stands in for the build plugin finishing a run, as `bun run dev` does on every rebuild.
const finishedBuildPlugin = createPlugin("finishedBuild", {
  depends: [buildPlugin],
  api: ctx => ({
    finish: (outDir: string) => ctx.emit("build:complete", { outDir, pageCount: 1, durationMs: 1 })
  })
});

function createSearchApp() {
  return createApp({
    plugins: [
      contentPlugin,
      collectionPlugin,
      buildPlugin,
      docsPlugin,
      searchPlugin,
      finishedBuildPlugin
    ],
    pluginConfigs: {
      site: SITE,
      content: { providers: [fileSystemContent({ contentDir: fixture("articles") })] },
      docs: { dir: fixture("docs") }
    }
  });
}

const readShard = (directory: string): SearchEntry[] =>
  JSON.parse(readFileSync(path.join(directory, "search", "en.json"), "utf8"));

describe("search plugin in a real app", () => {
  // Bug: the shard is written under another path than the ⌘K island fetches, or the rows on disk
  // lose docs sections, kinds or packages.
  it("write() persists the index from the fixture docs to <outDir>/search/en.json", async () => {
    const app = createSearchApp();
    await app.start();
    const directory = temporaryDirectory();

    const { count } = await app.search.write(directory);
    const rows = readShard(directory);

    expect(rows).toHaveLength(count);
    expect(rows).toEqual(await app.search.entries());
    const routing = rows.filter(row => row.href.startsWith("/docs/web/guides/routing/"));
    expect(routing.map(row => [row.kind, row.href])).toEqual([
      ["Guide", "/docs/web/guides/routing/"],
      ["Section", "/docs/web/guides/routing/#define-a-route"],
      ["Section", "/docs/web/guides/routing/#params-2"],
      ["Section", "/docs/web/guides/routing/#the-route-call"]
    ]);
    expect(rows.filter(row => row.href === "/docs/web/")).toEqual([
      {
        kind: "Package",
        title: "@moku-labs/web",
        subtitle: "Web.",
        href: "/docs/web/",
        icon: "web"
      }
    ]);
    expect(rows.find(row => row.href === "/docs/web/plugins/router/")?.kind).toBe("Plugin");
    expect(rows.find(row => row.href === "/docs/concepts/plugins/")?.kind).toBe("Concept");

    await app.stop();
  });

  // Bug: the build:complete hook is not wired, so `bun run dev` rebuilds serve a stale or no shard.
  it("writes the shard to the finished build's outDir on build:complete", async () => {
    const app = createSearchApp();
    await app.start();
    const directory = temporaryDirectory();

    app.finishedBuild.finish(directory);

    // The kernel does not await hooks: poll until the whole file is on disk and parses.
    const rows = await vi.waitFor(() => readShard(directory));
    expect(rows.some(row => row.kind === "Section")).toBe(true);
    await app.stop();
  });

  it("types the public API for consumers", () => {
    const app = createSearchApp();
    expectTypeOf(app.search.entries).returns.toEqualTypeOf<Promise<SearchEntry[]>>();
    // @ts-expect-error write takes an output directory, not a row count
    expectTypeOf(app.search.write).toBeCallableWith(3);
  });
});
