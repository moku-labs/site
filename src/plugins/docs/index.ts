/**
 * Complex tier — docs content: nested Markdown under content/docs, nav, TOC, prev/next.
 * Emits no events; renders through `ctx.require(contentPlugin).renderMarkdown` and drops its page
 * cache on the `build:phase` that starts a build run.
 *
 * @see README.md
 */
import { buildPlugin, contentPlugin, createPlugin } from "@moku-labs/web";
import { createDocumentationApi } from "./api";
import { createBuildPhaseHandler } from "./handlers";
import { createDocumentationState } from "./state";
import type { DocumentationConfig } from "./types";

const defaultConfig: DocumentationConfig = { dir: "content/docs" };

/**
 * The docs plugin: loads `content/docs/**` lazily on the first `app.docs` call, once per build
 * run. Depends on `contentPlugin` for the Markdown renderer and on `buildPlugin` for the
 * `build:phase` event that resets the cache.
 *
 * @see README.md
 */
export const docsPlugin = createPlugin("docs", {
  depends: [contentPlugin, buildPlugin],
  config: defaultConfig,
  createState: createDocumentationState,
  api: ctx => createDocumentationApi(ctx),
  hooks: ctx => ({ "build:phase": createBuildPhaseHandler(ctx) })
});
