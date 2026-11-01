/**
 * Standard tier — the ⌘K search index, written as a collection shard after every build.
 *
 * @see README.md
 */
import { buildPlugin, collectionPlugin, createPlugin } from "@moku-labs/web";
import { docsPlugin } from "../docs";
import { createSearchApi, writeSearchIndex } from "./api";
import type { SearchConfig } from "./types";

const defaultConfig: SearchConfig = { collection: "search", shard: "en", outDir: "dist" };

export const searchPlugin = createPlugin("search", {
  depends: [docsPlugin, collectionPlugin, buildPlugin],
  config: defaultConfig,
  api: () => createSearchApi(),
  hooks: () => ({ "build:complete": ({ outDir }) => writeSearchIndex(outDir) })
});
