/**
 * @file Hook handlers of the search plugin.
 */
import { startBuildWrite } from "./api";
import type { SearchContext, SearchSources } from "./types";

/** The part of the `build:complete` payload the handler reads. */
type BuildCompletePayload = {
  /** Output directory of the finished build. */
  outDir: string;
};

/**
 * Create the `build:complete` handler: start writing the index into the build that just
 * finished, so `bun run dev` rebuilds serve a fresh shard, and keep the write in state for
 * `app.search.write()`. The kernel runs the hooks of one event in turn, so the handler returns at
 * once instead of holding back the next plugin's hook. A failure is logged as
 * `search:write-failed` through `ctx.log.error` and never rejects.
 *
 * @param ctx - Plugin context: config, state, `require` and the core logger.
 * @param sources - Packages and demos; defaults to `src/data/*`.
 * @returns The handler; the write runs on after it returns.
 */
export function createBuildCompleteHandler(
  ctx: SearchContext,
  sources?: SearchSources
): (payload: BuildCompletePayload) => void {
  return ({ outDir }) => {
    startBuildWrite(ctx, outDir, sources).catch((error: unknown) => {
      if (error instanceof Error) ctx.log.error("search:write-failed", { outDir }, error);
      else ctx.log.error("search:write-failed", { outDir, error });
    });
  };
}
