/**
 * Standard tier — the ⌘K search index, written as a collection shard after every build.
 * Emits no events; listens to `build:complete`.
 *
 * @see README.md
 */
import { buildPlugin, collectionPlugin, createPlugin } from "@moku-labs/web";
import { docsPlugin } from "../docs";
import { createSearchApi } from "./api";
import { createBuildCompleteHandler } from "./handlers";
import type { SearchConfig } from "./types";

const defaultConfig: SearchConfig = { collection: "search", shard: "en", outDir: "dist" };

/**
 * The search plugin: builds the index from docs, packages, demos and fixed pages and writes it to
 * `<outDir>/<collection>/<shard>.json`. `buildPlugin` is a dependency for the visibility of its
 * `build:complete` event, which the hook listens to.
 *
 * @see README.md
 */
export const searchPlugin = createPlugin("search", {
  depends: [docsPlugin, collectionPlugin, buildPlugin],
  config: defaultConfig,
  api: ctx => createSearchApi(ctx),
  hooks: ctx => ({ "build:complete": createBuildCompleteHandler(ctx) })
});
