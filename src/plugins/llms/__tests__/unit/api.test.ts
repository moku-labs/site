import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import type { DocumentPage } from "../../../docs/types";
import { createLlmsApi } from "../../api";
import { createBuildCompleteHandler } from "../../handlers";
import { createLlmsState } from "../../state";
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
    state: createLlmsState(),
    require: () => ({ all }),
    log: { error }
  };
  const handler = createBuildCompleteHandler(ctx, sources());
  return { api: createLlmsApi(ctx, sources()), ctx, all, error, outDir, handler };
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

  // Bug: write writes fewer files than it reports, or ignores the configured outDir.
  it("write() writes every file into the configured outDir and counts them", async () => {
    const { api, outDir } = setup();
    const files = await api.files();
    const { count } = await api.write();
    expect(count).toBe(files.length);
    for (const file of files) {
      expect(readFileSync(path.join(outDir, file.path), "utf8")).toBe(file.content);
    }
  });

  // Bug: write(dir) writes to the config dir instead of the one the build passes.
  it("write(dir) writes into the given directory", async () => {
    const target = temporary();
    await setup().api.write(target);
    expect(readFileSync(path.join(target, "docs/web/llms.txt"), "utf8")).toContain(
      "# @moku-labs/web"
    );
  });

  // Bug: a failed write in the unawaited build:complete hook becomes an unhandled rejection.
  it("the build:complete handler logs a failure instead of rejecting", async () => {
    const { handler, error } = setup("");
    expect(handler({ outDir: temporary() })).toBeUndefined();
    await vi.waitFor(() =>
      expect(error).toHaveBeenCalledWith(
        "llms:write-failed",
        expect.objectContaining({ outDir: expect.any(String) }),
        expect.objectContaining({
          message: "[llms] siteUrl is empty.\n  Set pluginConfigs.llms.siteUrl."
        })
      )
    );
  });

  // Bug: a non-Error rejection (a thrown string) escapes the hook's catch.
  it("the build:complete handler logs a non-Error failure too", async () => {
    const { handler, all, error } = setup();
    all.mockRejectedValueOnce("docs load failed");
    handler({ outDir: temporary() });
    await vi.waitFor(() =>
      expect(error).toHaveBeenCalledWith("llms:write-failed", expect.anything(), undefined)
    );
  });
});

describe("llms api: the build's write", () => {
  // Bug: the hook holds the kernel's in-turn dispatch until its write ends, so a later plugin's
  // hook starts after scripts/build.ts already called its write(), and that plugin writes twice.
  it("the build:complete handler returns at once and keeps its write in state", () => {
    const { handler, ctx } = setup();
    const outDir = temporary();

    expect(handler({ outDir })).toBeUndefined();
    expect(ctx.state.pending?.outDir).toBe(outDir);
  });

  // Bug: every `bun run build` renders and writes the agent files twice, concurrently; or a
  // write to another directory gets the build's result and nothing lands there.
  it("write() for the build's directory returns the hook's write; another directory writes", async () => {
    const { api, handler, ctx, all } = setup();
    const outDir = temporary();
    handler({ outDir });

    expect(api.write(outDir)).toBe(ctx.state.pending?.promise);
    await api.write(outDir);
    expect(all).toHaveBeenCalledTimes(1);

    const other = temporary();
    await api.write(other);
    expect(all).toHaveBeenCalledTimes(2);
    expect(readFileSync(path.join(other, "llms.txt"), "utf8")).toContain("# Moku Labs");
  });

  // Bug: the hook reuses the first build's write, so a `bun run dev` rebuild serves old files, or
  // write() after a rebuild hands out the first build's write.
  it("every build starts a fresh write, and write() hands out the newest", async () => {
    const { api, handler, ctx, all } = setup();
    const outDir = temporary();
    handler({ outDir });
    const first = ctx.state.pending;
    handler({ outDir });
    expect(ctx.state.pending).not.toBe(first);

    await api.write(outDir);
    expect(all).toHaveBeenCalledTimes(2);
  });

  // Bug: one failed hook write poisons write(), so the build step fails again without trying.
  it("does not reuse a failed build write", async () => {
    const { api, handler, all, error } = setup();
    const outDir = temporary();
    all.mockRejectedValueOnce(new Error("docs down"));
    handler({ outDir });
    await vi.waitFor(() => expect(error).toHaveBeenCalledTimes(1));

    await api.write(outDir);
    expect(all).toHaveBeenCalledTimes(2);
    expect(readFileSync(path.join(outDir, "llms.txt"), "utf8")).toContain("# Moku Labs");
  });
});
