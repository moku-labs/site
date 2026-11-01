import type { Collection } from "@moku-labs/web";
import { describe, expect, it, vi } from "vitest";
import { docsPlugin } from "../../../docs";
import type { DocumentationApi } from "../../../docs/types";
import { createBuildCompleteHandler } from "../../handlers";
import type { SearchContext } from "../../types";

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
    require,
    log: { error }
  };
  const handler = createBuildCompleteHandler(ctx, { packages: () => [], demos: [] });
  return { handler, collection, error };
}

const PAYLOAD = { outDir: "out", pageCount: 3, durationMs: 12 };

describe("build:complete handler", () => {
  // Bug: the dev loop writes the shard to the configured dir instead of the one just built.
  it("writes the index to the outDir of the finished build", async () => {
    const { handler, collection, error } = setup(async () => []);
    await handler(PAYLOAD);
    expect(collection.write).toHaveBeenCalledWith(expect.any(Array), { outDir: "out" });
    expect(error).not.toHaveBeenCalled();
  });

  // Bug: a failed write becomes an unhandled rejection (the kernel does not await hooks) or vanishes.
  it("logs a failed write through ctx.log.error and resolves", async () => {
    const failure = new Error("docs broke");
    const { handler, collection, error } = setup(async () => {
      throw failure;
    });
    await expect(handler(PAYLOAD)).resolves.toBeUndefined();
    expect(collection.write).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalledWith("search:write-failed", { outDir: "out" }, failure);
  });

  // Bug: a non-Error rejection is passed to the logger as if it were an Error.
  it("logs a thrown non-Error value as data", async () => {
    const { handler, error } = setup(() => Promise.reject("plain"));
    await handler(PAYLOAD);
    expect(error).toHaveBeenCalledWith("search:write-failed", { outDir: "out", error: "plain" });
  });
});
