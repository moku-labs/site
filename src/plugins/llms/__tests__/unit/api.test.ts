import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import type { DocumentPage } from "../../../docs/types";
import { createLlmsApi, emitLlms } from "../../api";
import type { LlmsContext, LlmsSources } from "../../types";

const temporary = (): string => mkdtempSync(path.join(tmpdir(), "llms-api-"));

/** A node_modules dir with fake installed versions; `worker` is not installed on purpose. */
function fakeNodeModules(): string {
  const root = temporary();
  for (const [name, version] of [
    ["@moku-labs/core", "9.1.0"],
    ["@moku-labs/web", "9.2.0"]
  ] as const) {
    mkdirSync(path.join(root, name), { recursive: true });
    writeFileSync(path.join(root, name, "package.json"), JSON.stringify({ version }));
  }
  return root;
}

const documentPage = (pagePath: string, pkg: string, title: string): DocumentPage => ({
  path: pagePath,
  pkg,
  section: undefined,
  slug: "index",
  title,
  description: `${title}.`,
  order: 0,
  group: "Get started",
  drift: undefined,
  full: false,
  markdown: `## ${title}`,
  html: "",
  headings: [],
  file: ""
});

const sources = (): LlmsSources => ({
  site: { name: "Moku Labs", description: "A kernel family." },
  packages: [
    {
      id: "worker",
      name: "@moku-labs/worker",
      npm: "@moku-labs/worker",
      tagline: "",
      group: "Frameworks"
    },
    {
      id: "claude",
      name: "moku plugin",
      // oxlint-disable-next-line unicorn/no-null -- PackageEntry marks "not on npm" with null.
      npm: null,
      manualVersion: "0.48.0",
      tagline: "",
      group: "Start"
    },
    {
      id: "web",
      name: "@moku-labs/web",
      npm: "@moku-labs/web",
      tagline: "Web.",
      group: "Frameworks"
    }
  ],
  demos: [],
  about: { name: "", motto: "", bio: [], links: [] },
  installCommands: [],
  prompts: [],
  nodeModules: fakeNodeModules()
});

function setup(siteUrl = "https://moku-labs.com", outDir = temporary()) {
  const all = vi.fn(async () => [
    documentPage("/docs/concepts/plugins/", "concepts", "Plugins"),
    documentPage("/docs/web/", "web", "Overview"),
    documentPage("/docs/claude/", "claude", "Claude")
  ]);
  const error = vi.fn();
  const ctx: LlmsContext = {
    config: { siteUrl, outDir },
    require: () => ({ all }),
    log: { error }
  };
  return { api: createLlmsApi(ctx, sources()), ctx, all, error, outDir };
}

describe("llms api", () => {
  // Bug: the Source version is typed by hand, concepts get no version, or an uninstalled package
  // without docs pages (worker) fails the build.
  it("files() reads versions from node_modules for the packages that have pages", async () => {
    const files = await setup().api.files();
    const content = (file: string) => files.find(entry => entry.path === file)?.content;
    expect(content("docs/web.md")).toContain(
      "Source: https://moku-labs.com/docs/web/ · @moku-labs/web@9.2.0"
    );
    expect(content("docs/concepts/plugins.md")).toContain(
      "Source: https://moku-labs.com/docs/concepts/plugins/ · @moku-labs/core@9.1.0"
    );
    expect(content("docs/claude.md")).toContain(
      "Source: https://moku-labs.com/docs/claude/ · moku plugin@0.48.0"
    );
    expect(content("llms.txt")).toContain("## Concepts\n\n- [Plugins]");
  });

  // Bug: "View as .md" on the docs hub (/docs/) is a 404 because no docs.md is written.
  it("files() writes docs.md for the docs hub, listed in llms.txt", async () => {
    const files = await setup().api.files();
    const content = (file: string) => files.find(entry => entry.path === file)?.content;
    expect(content("docs.md")).toContain(
      "- [@moku-labs/web](https://moku-labs.com/docs/web.md): Web."
    );
    expect(content("llms.txt")).toContain("- [Docs](https://moku-labs.com/docs.md):");
  });

  // Bug: emit writes fewer files than it reports, or ignores the configured outDir.
  it("emit() writes every file into the configured outDir and counts them", async () => {
    const { api, outDir } = setup();
    const files = await api.files();
    const { count } = await api.emit();
    expect(count).toBe(files.length);
    for (const file of files) {
      expect(readFileSync(path.join(outDir, file.path), "utf8")).toBe(file.content);
    }
  });

  // Bug: emit(dir) writes to the config dir instead of the one the build passes.
  it("emit(dir) writes into the given directory", async () => {
    const target = temporary();
    await setup().api.emit(target);
    expect(readFileSync(path.join(target, "docs/web/llms.txt"), "utf8")).toContain(
      "# @moku-labs/web"
    );
  });

  // Bug: a failed write in the unawaited build:complete hook becomes an unhandled rejection.
  it("emitLlms logs a failure instead of rejecting", async () => {
    const { ctx, error } = setup("");
    await expect(emitLlms(ctx, temporary())).resolves.toBeUndefined();
    expect(error).toHaveBeenCalledWith(
      "llms:emit",
      expect.objectContaining({ outDir: expect.any(String) }),
      expect.objectContaining({
        message: "[llms] siteUrl is empty.\n  Set pluginConfigs.llms.siteUrl."
      })
    );
  });

  // Bug: a non-Error rejection (a thrown string) escapes the hook's catch.
  it("emitLlms logs a non-Error failure too", async () => {
    const { ctx, all, error } = setup();
    all.mockRejectedValueOnce("docs load failed");
    await expect(emitLlms(ctx, temporary())).resolves.toBeUndefined();
    expect(error).toHaveBeenCalledWith("llms:emit", expect.anything(), undefined);
  });
});
