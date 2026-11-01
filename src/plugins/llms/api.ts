/**
 * @file API factory of the llms plugin.
 */
import type { LlmsApi } from "./types";

/**
 * Throw the skeleton marker for an API method that is not built yet.
 *
 * @throws {Error} Always.
 */
function notImplemented(): never {
  throw new Error("not implemented");
}

/**
 * Build the llms API.
 *
 * @returns The API mounted at `app.llms`.
 */
export function createLlmsApi(): LlmsApi {
  return { files: notImplemented, emit: notImplemented };
}

/**
 * Write the agent-facing files after a build; called by the `build:complete` hook.
 *
 * @param _outputDirectory - Build output directory.
 */
export function emitLlms(_outputDirectory: string): void {
  return;
}
