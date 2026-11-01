/**
 * @file Hook handlers of the search plugin.
 */
import { writeSearchIndex } from "./api";
import type { SearchContext, SearchSources } from "./types";

/** The part of the `build:complete` payload the handler reads. */
type BuildCompletePayload = {
  /** Output directory of the finished build. */
  outDir: string;
};

/**
 * Create the `build:complete` handler: write the index into the build that just finished, so
 * `bun run dev` rebuilds serve a fresh shard. The kernel does not await hooks, so a failure is
 * logged as `search:write-failed` through `ctx.log.error` and never rejects.
 *
 * @param ctx - Plugin context: config, `require` and the core logger.
 * @param sources - Packages and demos; defaults to `src/data/*`.
 * @returns The handler; it resolves once the shard is written or the failure is logged.
 */
export function createBuildCompleteHandler(
  ctx: SearchContext,
  sources?: SearchSources
): (payload: BuildCompletePayload) => Promise<void> {
  return async ({ outDir }) => {
    try {
      await writeSearchIndex(ctx, outDir, sources);
    } catch (error) {
      if (error instanceof Error) ctx.log.error("search:write-failed", { outDir }, error);
      else ctx.log.error("search:write-failed", { outDir, error });
    }
  };
}
