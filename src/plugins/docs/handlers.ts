/**
 * @file Hook handlers of the docs plugin.
 */
import { resetDocumentationState } from "./state";
import type { DocumentationState } from "./types";

/** The part of the `build:phase` payload the handler reads. */
type BuildPhasePayload = {
  /** The phase that starts or ends. */
  phase: string;
  /** Whether the phase starts or ends. */
  status: "start" | "done";
};

/** The plugin context fields the handler reads. */
type PhaseContext = {
  /** The plugin state that holds the page cache. */
  readonly state: DocumentationState;
};

/** The phase that opens every build run, before any route loader reads the docs. */
const RUN_START_PHASE = "bundle";

/**
 * Create the `build:phase` handler: drop the page cache when a build run starts, so a
 * `bun run dev` rebuild reads the edited Markdown. The later phases of the same run keep the
 * cache, so every page renders once per run, also for the `build:complete` writers.
 *
 * @param ctx - Plugin context: the state that holds the page cache.
 * @returns The handler.
 */
export function createBuildPhaseHandler(ctx: PhaseContext): (payload: BuildPhasePayload) => void {
  return ({ phase, status }) => {
    if (status === "start" && phase === RUN_START_PHASE) resetDocumentationState(ctx.state);
  };
}
