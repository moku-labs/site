/**
 * @file API factory of the docs plugin.
 */
import type { DocumentationApi } from "./types";

/**
 * Throw the skeleton marker for an API method that is not built yet.
 *
 * @throws {Error} Always.
 */
function notImplemented(): never {
  throw new Error("not implemented");
}

/**
 * Build the docs API. Pages load lazily from the configured dir on the first call.
 *
 * @returns The API mounted at `app.docs`.
 */
export function createDocumentationApi(): DocumentationApi {
  return {
    all: notImplemented,
    get: notImplemented,
    byPackage: notImplemented,
    nav: notImplemented,
    neighbours: notImplemented,
    params: notImplemented
  };
}
