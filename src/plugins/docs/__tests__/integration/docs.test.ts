import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildPlugin,
  contentPlugin,
  createApp,
  createPlugin,
  fileSystemContent
} from "@moku-labs/web";
import { describe, expect, expectTypeOf, it, vi } from "vitest";
import { SITE } from "../../../../config";
import { docsPlugin } from "../..";
import type { DocumentPage } from "../../types";

// The real family is filled in the data wave; the fixture tree uses these three, `worker` empty.
vi.mock("../../../../data/packages", () => ({
  packages: [
    { id: "core", name: "@moku-labs/core", npm: "@moku-labs/core", tagline: "", group: "Core" },
    {
      id: "worker",
      name: "@moku-labs/worker",
      npm: "@moku-labs/worker",
      tagline: "",
      group: "Frameworks"
    },
    { id: "web", name: "@moku-labs/web", npm: "@moku-labs/web", tagline: "", group: "Frameworks" }
  ]
}));

const fixture = (name: string): string =>
  fileURLToPath(new URL(`../fixtures/${name}`, import.meta.url));

/** Fires `build:phase` the way the build plugin does at each phase boundary. */
const phaseSignal = createPlugin("phaseSignal", {
  depends: [buildPlugin],
  api: ctx => ({
    start: (phase: "bundle" | "pages") => ctx.emit("build:phase", { phase, status: "start" })
  })
});

function createDocsApp(directory = fixture("docs")) {
  return createApp({
    plugins: [contentPlugin, buildPlugin, docsPlugin, phaseSignal],
    pluginConfigs: {
      site: SITE,
      content: { providers: [fileSystemContent({ contentDir: fixture("articles") })] },
      docs: { dir: directory }
    }
  });
}

describe("docs plugin in a real app", () => {
  // Bug: the docs plugin is not wired to the content renderer, so pages ship without Shiki
  // markup, or package data from src/data/packages.ts does not reach the loader.
  it("renders a page through contentPlugin and navigates with the data's package order", async () => {
    const app = createDocsApp();
    await app.start();

    const page = await app.docs.get("/docs/web/guides/routing/");
    expect(page?.html).toContain('class="shiki');
    expect(page?.html).toMatch(/<h2[^>]*>Define a route<\/h2>/);
    expect(page?.headings[0]).toEqual({ id: "define-a-route", text: "Define a route", depth: 2 });
    expect(await app.docs.neighbours("/docs/core/")).toEqual({
      prev: { path: "/docs/concepts/three-layers/", title: "Three layers" },
      next: { path: "/docs/web/", title: "Overview" }
    });

    await app.stop();
  });

  // Bug: the page cache outlives a build run, so a `bun run dev` rebuild after a content/docs edit
  // serves the old page; or a later phase empties it, and the build:complete writers render the
  // whole tree a second time.
  it("reads the edited Markdown when a build run starts, and keeps the cache within a run", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "docs-rebuild-"));
    await cp(fixture("docs"), directory, { recursive: true });
    const file = path.join(directory, "core", "index.md");
    const app = createDocsApp(directory);
    await app.start();
    const coreTitle = async (): Promise<string | undefined> => {
      const page = await app.docs.get("/docs/core/");
      return page?.title;
    };
    expect(await coreTitle()).toBe("Core");

    const source = await readFile(file, "utf8");
    await writeFile(file, source.replace("title: Core", "title: Kernel"));
    app.phaseSignal.start("pages");
    expect(await coreTitle()).toBe("Core");

    app.phaseSignal.start("bundle");
    expect(await coreTitle()).toBe("Kernel");

    await app.stop();
    await rm(directory, { recursive: true, force: true });
  });

  it("types the public API for consumers", () => {
    const app = createDocsApp();
    expectTypeOf(app.docs.get).returns.toEqualTypeOf<Promise<DocumentPage | undefined>>();
    expectTypeOf(app.docs.nav).toBeCallableWith("web");
    // @ts-expect-error nav takes a package id, not a depth
    expectTypeOf(app.docs.nav).toBeCallableWith(1);
  });
});
