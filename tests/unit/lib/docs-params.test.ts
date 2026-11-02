import { describe, expect, it } from "vitest";
import {
  packageParameters,
  pageParameters,
  sectionPageParameters
} from "../../../src/lib/docs-params";

/** A docs API whose `params` returns fixed records per depth. */
function paramsSource(byDepth: Record<1 | 2 | 3, Record<string, string>[]>) {
  return { params: async (depth: 1 | 2 | 3) => byDepth[depth] };
}

describe("docs route params", () => {
  // Bug: a route keeps a stray key or drops one, so the build writes the page to the wrong path.
  it("gives each docs route exactly the params of its pattern", async () => {
    const docs = paramsSource({
      1: [{ pkg: "web" }],
      2: [{ pkg: "web", page: "quick-start" }],
      3: [{ pkg: "web", section: "guides", page: "routing" }]
    });

    expect(await packageParameters(docs)).toEqual([{ pkg: "web" }]);
    expect(await pageParameters(docs)).toEqual([{ pkg: "web", page: "quick-start" }]);
    expect(await sectionPageParameters(docs)).toEqual([
      { pkg: "web", section: "guides", page: "routing" }
    ]);
  });

  // Bug: a record without `section` builds /docs/web/undefined/routing/ instead of failing.
  it("fails the build naming the missing param", async () => {
    const docs = paramsSource({ 1: [], 2: [], 3: [{ pkg: "web", page: "routing" }] });

    await expect(sectionPageParameters(docs)).rejects.toThrow('miss "section"');
  });
});
