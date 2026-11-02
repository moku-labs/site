import { describe, expect, it } from "vitest";
import { trayPlugins } from "../../../src/data/tray";
import { loadHome } from "../../../src/lib/home-data";
import type { KernelError, TrayMessages } from "../../../src/lib/kernel-errors";
import type { ResolvedPackage } from "../../../src/lib/packages";

const error = (id: string): KernelError => ({
  id,
  when: "createApp",
  message: `[web] ${id}.\n  Fix it.`,
  hint: "Fix it."
});

const allErrors = [
  "duplicate-name",
  "missing-dependency",
  "dependency-order",
  "reserved-name",
  "core-plugin-clash"
].map(id => error(id));

const messages: TrayMessages = { duplicate: { router: "dup" }, missing: {}, reserved: {} };

const packages: ResolvedPackage[] = [
  {
    id: "core",
    name: "@moku-labs/core",
    npm: "@moku-labs/core",
    tagline: "Kernel.",
    group: "Core",
    version: "1.7.6"
  },
  {
    id: "claude",
    name: "Claude plugin",
    // oxlint-disable-next-line unicorn/no-null -- PackageEntry marks "not on npm" with null.
    npm: null,
    manualVersion: "0.85.6",
    tagline: "Conductor.",
    group: "Start",
    version: "0.85.6"
  }
];

/** Sources whose kernel returns `errors`, and a renderer that records what it was given. */
function sources(errors: KernelError[] = allErrors) {
  const rendered: string[] = [];
  return {
    rendered,
    input: {
      kernel: {
        errors: async () => errors,
        trayMessages: async () => messages
      },
      content: {
        renderMarkdown: async (markdown: string) => {
          rendered.push(markdown);
          return "<figure>code</figure>";
        }
      },
      packages
    }
  };
}

describe("loadHome", () => {
  // Bug: the cards show the wrong checks or another order, or the count drops checks.
  it("picks the three card checks in card order and counts every check", async () => {
    const view = await loadHome(sources().input);

    expect(view.checks.map(check => check.id)).toEqual([
      "duplicate-name",
      "missing-dependency",
      "reserved-name"
    ]);
    expect(view.checkCount).toBe(5);
  });

  // Bug: the hero gets messages for another tray, or no kernel version for the tooltip.
  it("hands the hero the tray, the captured messages and the installed core version", async () => {
    const view = await loadHome(sources().input);

    expect(view.hero.tray).toBe(trayPlugins);
    expect(view.hero.messages).toBe(messages);
    expect(view.hero.kernelVersion).toBe("1.7.6");
    expect(view.claude.version).toBe("0.85.6");
  });

  // Bug: the layers code skips the docs pipeline and ships unhighlighted, or loses its file tab.
  it("renders the layers code through the Markdown pipeline with its file name", async () => {
    const { input, rendered } = sources();
    const view = await loadHome(input);

    expect(view.layersCode).toBe("<figure>code</figure>");
    expect(rendered[0]).toMatch(/^```ts file="my-site\.ts"/);
    expect(rendered[0]?.split("\n")).toHaveLength(5);
  });

  // Bug: a card check the kernel dropped renders an empty card instead of failing the build.
  it("throws when a card check is gone", async () => {
    await expect(loadHome(sources(allErrors.slice(0, 2)).input)).rejects.toThrow(
      '[site] Kernel check "reserved-name" is gone.'
    );
  });
});
