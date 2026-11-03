/**
 * Complex tier — one 1200x630 share card per page, drawn locally by `bun run og` into `public/og/`
 * and committed. The build and CI never draw: `publicDir` copies the files. Emits no events, hooks
 * nothing; reads pages through `ctx.require(docsPlugin).all()`.
 *
 * @see README.md
 */
import { createPlugin } from "@moku-labs/web";
import { docsPlugin } from "../docs";
import { createOgApi } from "./api";
import type { OgConfig } from "./types";

const defaultConfig: OgConfig = { outDir: "public/og", manifest: "src/data/og-manifest.json" };

/**
 * Complex tier. Emits no events.
 *
 * The og plugin: `app.og.cards()` lists every card without loading a drawing library,
 * `app.og.write()`, which `scripts/og.ts` awaits, draws the cards whose input changed. Depends on
 * `docsPlugin` for the pages.
 *
 * @see README.md
 */
export const ogPlugin = createPlugin("og", {
  depends: [docsPlugin],
  config: defaultConfig,
  api: ctx => createOgApi(ctx)
});
