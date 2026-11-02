/**
 * Complex tier — `.md` pages, llms.txt and llms-full.txt, written after every build.
 * Emits no events; reads pages through `ctx.require(docsPlugin).all()` and checks the `siteUrl`
 * sentinel in `onInit`.
 *
 * @see README.md
 */
import { buildPlugin, createPlugin } from "@moku-labs/web";
import { docsPlugin } from "../docs";
import { createLlmsApi } from "./api";
import { createBuildCompleteHandler } from "./handlers";
import { checkSiteUrl } from "./render";
import { createLlmsState } from "./state";
import type { LlmsConfig } from "./types";

const defaultConfig: LlmsConfig = { siteUrl: "", outDir: "dist" };

/**
 * The llms plugin: writes the agent-facing files on `build:complete` (logged, not awaited by the
 * kernel); `app.llms.write()`, which `scripts/build.ts` awaits, returns that write. Depends on
 * `docsPlugin` for the pages and on `buildPlugin` for the `build:complete` event.
 *
 * @see README.md
 */
export const llmsPlugin = createPlugin("llms", {
  depends: [docsPlugin, buildPlugin],
  config: defaultConfig,
  createState: createLlmsState,
  api: ctx => createLlmsApi(ctx),
  hooks: ctx => ({ "build:complete": createBuildCompleteHandler(ctx) }),
  onInit: ctx => {
    checkSiteUrl(ctx.config.siteUrl);
  }
});
