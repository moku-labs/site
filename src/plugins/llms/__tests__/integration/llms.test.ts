import { existsSync, mkdtempSync, readdirSync, readFileSync } from "node:fs";
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
import { describe, expect, it, vi } from "vitest";
import { SITE } from "../../../../config";
import { docsPlugin } from "../../../docs";
import { llmsPlugin } from "../..";

// The real family is filled in the data wave; the docs fixture tree uses core and web.
vi.mock("../../../../data/packages", () => ({
  packages: [
    { id: "core", name: "@moku-labs/core", npm: "@moku-labs/core", tagline: "", group: "Core" },
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
const temporary = (): string => mkdtempSync(path.join(tmpdir(), "llms-app-"));
const installedVersion = (npm: string): string =>
  JSON.parse(readFileSync(path.join("node_modules", npm, "package.json"), "utf8")).version;

/** Fires `build:complete` the way the build plugin does at the end of a build. */
const buildSignal = createPlugin("buildSignal", {
  depends: [buildPlugin],
  api: ctx => ({
    complete: (outDir: string) =>
      ctx.emit("build:complete", { outDir, pageCount: 0, durationMs: 0 })
  })
});

function createLlmsApp() {
  return createApp({
    plugins: [contentPlugin, buildPlugin, docsPlugin, llmsPlugin, buildSignal],
    pluginConfigs: {
      site: SITE,
      content: { providers: [fileSystemContent({ contentDir: fixture("articles") })] },
      docs: { dir: fixture("docs") },
      llms: { siteUrl: SITE.url, outDir: temporary() }
    }
  });
}

describe("llms plugin in a real app", () => {
  // Bug: the plugin is not wired to the docs plugin or the installed versions, or emit reports a
  // count that differs from the files on disk.
  it("emit(dir) writes the agent files for the docs tree and returns their count", async () => {
    const app = createLlmsApp();
    await app.start();
    const target = temporary();

    const { count } = await app.llms.emit(target);
    const written = readdirSync(target, { recursive: true, withFileTypes: true }).filter(entry =>
      entry.isFile()
    );
    expect(count).toBe(written.length);
    const read = (file: string): string => readFileSync(path.join(target, file), "utf8");
    expect(read("docs/web/guides/routing.md")).toContain(
      `Source: ${SITE.url}/docs/web/guides/routing/ · @moku-labs/web@${installedVersion("@moku-labs/web")}`
    );
    const pages = await app.docs.all();
    expect(read("llms.txt").match(/^- \[.*\.md\)/gm)).toHaveLength(pages.length + 3);
    expect(read("docs/web/llms.txt")).not.toContain("/docs/core/");
    expect(existsSync(path.join(target, "index.md"))).toBe(true);

    await app.stop();
  });

  // Bug: the build:complete hook is not wired, or writes to the config dir instead of the build's.
  it("writes the files into the outDir of build:complete", async () => {
    const app = createLlmsApp();
    await app.start();
    const target = temporary();

    await app.buildSignal.complete(target);
    await vi.waitFor(() => expect(existsSync(path.join(target, "llms-full.txt"))).toBe(true));

    await app.stop();
  });
});
