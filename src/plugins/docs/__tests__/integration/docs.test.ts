import { fileURLToPath } from "node:url";
import { contentPlugin, createApp, fileSystemContent } from "@moku-labs/web";
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

function createDocsApp() {
  return createApp({
    plugins: [contentPlugin, docsPlugin],
    pluginConfigs: {
      site: SITE,
      content: { providers: [fileSystemContent({ contentDir: fixture("articles") })] },
      docs: { dir: fixture("docs") }
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

  it("types the public API for consumers", () => {
    const app = createDocsApp();
    expectTypeOf(app.docs.get).returns.toEqualTypeOf<Promise<DocumentPage | undefined>>();
    expectTypeOf(app.docs.nav).toBeCallableWith("web");
    // @ts-expect-error nav takes a package id, not a depth
    expectTypeOf(app.docs.nav).toBeCallableWith(1);
  });
});
