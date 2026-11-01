/**
 * Standard tier — docs content: nested Markdown under content/docs, nav, TOC, prev/next.
 *
 * @see README.md
 */
import { contentPlugin, createPlugin } from "@moku-labs/web";
import { createDocumentationApi } from "./api";
import { createDocumentationState } from "./state";
import type { DocumentationConfig } from "./types";

const defaultConfig: DocumentationConfig = { dir: "content/docs" };

export const docsPlugin = createPlugin("docs", {
  depends: [contentPlugin],
  config: defaultConfig,
  createState: createDocumentationState,
  api: () => createDocumentationApi()
});
