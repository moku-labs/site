/**
 * Standard tier — `.md` pages, llms.txt and llms-full.txt, written after every build.
 * Emits no events; reads pages through `ctx.require(docsPlugin).all()`.
 *
 * @see README.md
 */
import { buildPlugin, createPlugin } from "@moku-labs/web";
import { docsPlugin } from "../docs";
import { createLlmsApi, emitLlms } from "./api";
import type { LlmsConfig } from "./types";

const defaultConfig: LlmsConfig = { siteUrl: "", outDir: "dist" };

/**
 * The llms plugin: writes the agent-facing files on `build:complete` (logged, not awaited by the
 * kernel) and on `app.llms.emit()`, which `scripts/build.ts` awaits. Depends on `docsPlugin` for
 * the pages and on `buildPlugin` for the `build:complete` event.
 *
 * @see README.md
 */
export const llmsPlugin = createPlugin("llms", {
  depends: [docsPlugin, buildPlugin],
  config: defaultConfig,
  api: ctx => createLlmsApi(ctx),
  hooks: ctx => ({ "build:complete": ({ outDir }) => emitLlms(ctx, outDir) })
});
