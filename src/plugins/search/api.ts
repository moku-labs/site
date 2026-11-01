/**
 * @file API factory and index builder of the search plugin.
 */
import type { SearchApi } from "./types";

/**
 * Throw the skeleton marker for an API method that is not built yet.
 *
 * @throws {Error} Always.
 */
function notImplemented(): never {
  throw new Error("not implemented");
}

/**
 * Build the search API.
 *
 * @returns The API mounted at `app.search`.
 */
export function createSearchApi(): SearchApi {
  return { entries: notImplemented, write: notImplemented };
}

/**
 * Write the index after a build; called by the `build:complete` hook.
 *
 * @param _outputDirectory - Build output directory.
 */
export function writeSearchIndex(_outputDirectory: string): void {
  return;
}
