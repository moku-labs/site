/**
 * Standard tier — docs content: nested Markdown under content/docs, nav, TOC, prev/next.
 * Emits no events; renders through `ctx.require(contentPlugin).renderMarkdown`.
 *
 * @see README.md
 */
import { contentPlugin, createPlugin } from "@moku-labs/web";
import { createDocumentationApi } from "./api";
import { createDocumentationState } from "./state";
import type { DocumentationConfig } from "./types";

const defaultConfig: DocumentationConfig = { dir: "content/docs" };

/**
 * The docs plugin: loads `content/docs/**` lazily on the first `app.docs` call.
 * Depends on `contentPlugin` for the Markdown renderer.
 *
 * @see README.md
 */
export const docsPlugin = createPlugin("docs", {
  depends: [contentPlugin],
  config: defaultConfig,
  createState: createDocumentationState,
  api: ctx => createDocumentationApi(ctx)
});
