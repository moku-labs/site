import { contentPlugin } from "@moku-labs/web";
import { describe, expect, it } from "vitest";
import { contentReference } from "../../src/lib/content-reference";
import { docsReference } from "../../src/lib/docs-reference";
import { docsPlugin } from "../../src/plugins/docs";

// The route loaders reach the Node plugins through `{ name } as typeof plugin` stand-ins, and the
// kernel's `require` finds a plugin by that name. The cast hides a mismatch from `tsc`.
describe("plugin references for route loaders", () => {
  // Bug: a plugin is renamed and its stand-in keeps the old name, so every docs, home or code
  // sample loader fails at build with "Plugin is not registered".
  it("carry the exact name of the plugin they stand in for", () => {
    expect(docsReference.name).toBe(docsPlugin.name);
    expect(contentReference.name).toBe(contentPlugin.name);
  });
});
