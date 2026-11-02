/**
 * @file Hook handlers of the llms plugin.
 */
import { startBuildWrite } from "./api";
import type { LlmsContext, LlmsSources } from "./types";

/** The part of the `build:complete` payload the handler reads. */
type BuildCompletePayload = {
  /** Output directory of the finished build. */
  outDir: string;
};

/**
 * Create the `build:complete` handler: start writing the agent files into the build that just
 * finished, so `bun run dev` rebuilds serve fresh files, and keep the write in state for
 * `app.llms.write()`. The kernel runs the hooks of one event in turn, so the handler returns at
 * once instead of holding back the next plugin's hook. A failure is logged as
 * `llms:write-failed` instead of rejecting into nowhere.
 *
 * @param ctx - Plugin context: config, state, `require` and the core logger.
 * @param sources - Site identity, data and `node_modules`; defaults to the real ones.
 * @returns The handler; the write runs on after it returns.
 */
export function createBuildCompleteHandler(
  ctx: LlmsContext,
  sources?: LlmsSources
): (payload: BuildCompletePayload) => void {
  return ({ outDir }) => {
    startBuildWrite(ctx, outDir, sources).catch((error: unknown) => {
      ctx.log.error("llms:write-failed", { outDir }, error instanceof Error ? error : undefined);
    });
  };
}
