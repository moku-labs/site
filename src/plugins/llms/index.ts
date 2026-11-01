/**
 * Standard tier — `.md` pages, llms.txt and llms-full.txt, written after every build.
 *
 * @see README.md
 */
import { buildPlugin, createPlugin } from "@moku-labs/web";
import { docsPlugin } from "../docs";
import { createLlmsApi, emitLlms } from "./api";
import type { LlmsConfig } from "./types";

const defaultConfig: LlmsConfig = { siteUrl: "", outDir: "dist" };

export const llmsPlugin = createPlugin("llms", {
  depends: [docsPlugin, buildPlugin],
  config: defaultConfig,
  api: () => createLlmsApi(),
  hooks: () => ({ "build:complete": ({ outDir }) => emitLlms(outDir) })
});
