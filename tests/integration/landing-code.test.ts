import path from "node:path";
import { describe, expect, it } from "vitest";
import { LAYERS } from "../../src/components/layers-stack";
import { LAYERS_LINES } from "../../src/lib/home-data";
import { checkSnippets } from "../../src/lib/snippets";

const repository = path.resolve(import.meta.dirname, "..", "..");

/** What the page leaves out: code line N is layer N, so the imports stay off the visible sample. */
const LAYERS_IMPORTS = [
  'import { createCoreConfig } from "@moku-labs/core";',
  'import type { Config, Events } from "./plugins";',
  'import { blogPlugin, routerPlugin } from "./plugins";'
];

describe("the landing's three-layers sample", () => {
  // Bug: a core release renames or drops createCoreConfig or createApp, or the sample calls an
  // API that never existed, and the landing teaches code that does not compile.
  it("compiles against the installed packages, with only the imports added", async () => {
    const failures = await checkSnippets(
      [
        {
          file: "content/docs/landing-layers/sample.md",
          markdown: ["```ts check", ...LAYERS_IMPORTS, ...LAYERS_LINES, "```", ""].join("\n")
        }
      ],
      repository
    );

    expect(failures).toEqual([]);
  }, 120_000);

  // Bug: the sample's call is renamed to keep it compiling, and the slab beside it still names
  // the old call. Code line N is layer N.
  it("names on each line the call its slab and step show", () => {
    for (const layer of LAYERS) {
      expect(LAYERS_LINES[layer.level - 1]).toContain(layer.call);
    }
  });
});
