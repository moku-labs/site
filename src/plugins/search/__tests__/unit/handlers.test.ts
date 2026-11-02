import type { Collection } from "@moku-labs/web";
import { describe, expect, it, vi } from "vitest";
import { docsPlugin } from "../../../docs";
import type { DocumentationApi } from "../../../docs/types";
import { createSearchApi } from "../../api";
import { createBuildCompleteHandler } from "../../handlers";
import { createSearchState } from "../../state";
import type { SearchContext, SearchSources } from "../../types";

function setup(all: DocumentationApi["all"]) {
  const collection: Pick<Collection.CollectionProvider, "write"> = {
    write: vi.fn(async () => ({ fileCount: 1, bytes: 2, files: ["search/en.json"] }))
  };
  const docs: Pick<DocumentationApi, "all"> = { all };
  const require = ((plugin: object) =>
    plugin === docsPlugin ? docs : collection) as unknown as SearchContext["require"];
  const error = vi.fn();
  const ctx: SearchContext = {
    config: { collection: "search", shard: "en", outDir: "dist" },
    state: createSearchState(),
    require,
    log: { error }
  };
  const sources: SearchSources = { packages: () => [], demos: [] };
  const handler = createBuildCompleteHandler(ctx, sources);
  return { handler, collection, error, ctx, api: createSearchApi(ctx, sources) };
}

const PAYLOAD = { outDir: "out", pageCount: 3, durationMs: 12 };

describe("build:complete handler", () => {
  // Bug: the dev loop writes the shard to the configured dir instead of the one just built.
  it("writes the index to the outDir of the finished build", async () => {
    const { handler, collection, error, ctx } = setup(async () => []);
    handler(PAYLOAD);
    await ctx.state.pending?.promise;
    expect(collection.write).toHaveBeenCalledWith(expect.any(Array), { outDir: "out" });
    expect(error).not.toHaveBeenCalled();
  });

  // Bug: a failed write becomes an unhandled rejection (the kernel does not await hooks) or vanishes.
  it("logs a failed write through ctx.log.error and resolves", async () => {
    const failure = new Error("docs broke");
    const { handler, collection, error } = setup(async () => {
      throw failure;
    });
    expect(handler(PAYLOAD)).toBeUndefined();
    await vi.waitFor(() =>
      expect(error).toHaveBeenCalledWith("search:write-failed", { outDir: "out" }, failure)
    );
    expect(collection.write).not.toHaveBeenCalled();
  });

  // Bug: a non-Error rejection is passed to the logger as if it were an Error.
  it("logs a thrown non-Error value as data", async () => {
    const { handler, error } = setup(() => Promise.reject("plain"));
    handler(PAYLOAD);
    await vi.waitFor(() =>
      expect(error).toHaveBeenCalledWith("search:write-failed", { outDir: "out", error: "plain" })
    );
  });
});

describe("the build's write", () => {
  // Bug: the hook holds the kernel's in-turn dispatch until its shard is written, so the llms hook
  // starts after scripts/build.ts already called app.llms.write(), and the agent files are
  // written twice.
  it("the handler returns at once and keeps its write in state", () => {
    const { handler, ctx } = setup(async () => []);

    expect(handler(PAYLOAD)).toBeUndefined();
    expect(ctx.state.pending?.outDir).toBe("out");
  });

  // Bug: every `bun run build` builds and writes the shard twice, concurrently; or a write to
  // another directory gets the build's result and nothing lands there.
  it("write() for the build's directory returns the hook's write; another directory writes", async () => {
    const { handler, api, ctx, collection } = setup(async () => []);
    handler(PAYLOAD);

    expect(api.write("out")).toBe(ctx.state.pending?.promise);
    await api.write("out");
    expect(collection.write).toHaveBeenCalledTimes(1);

    await api.write("preview");
    expect(collection.write).toHaveBeenCalledTimes(2);
    expect(collection.write).toHaveBeenLastCalledWith(expect.any(Array), { outDir: "preview" });
  });

  // Bug: the hook reuses the first build's write, so a `bun run dev` rebuild serves the old shard,
  // or write() after a rebuild hands out the first build's write.
  it("every build starts a fresh write, and write() hands out the newest", async () => {
    const { handler, api, ctx, collection } = setup(async () => []);
    handler(PAYLOAD);
    const first = ctx.state.pending;
    handler(PAYLOAD);
    expect(ctx.state.pending).not.toBe(first);

    await api.write("out");
    expect(collection.write).toHaveBeenCalledTimes(2);
  });

  // Bug: one failed hook write poisons write(), so the build step fails again without trying.
  it("does not reuse a failed build write", async () => {
    const all = vi
      .fn<DocumentationApi["all"]>()
      .mockRejectedValueOnce(new Error("docs down"))
      .mockResolvedValue([]);
    const { handler, api, collection, error } = setup(all);
    handler(PAYLOAD);
    await vi.waitFor(() => expect(error).toHaveBeenCalledTimes(1));

    await expect(api.write("out")).resolves.toEqual({ count: 4 });
    expect(collection.write).toHaveBeenCalledTimes(1);
  });
});
