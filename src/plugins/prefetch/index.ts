/**
 * Standard tier — warms the data of the pages a reader is about to open. Browser only: composed
 * in `src/spa.tsx`, never in the Node app. Emits no events; listens to `spa:navigated`.
 *
 * @see README.md
 */
import { createPlugin, dataPlugin, spaPlugin } from "@moku-labs/web/browser";
import { createLinkWarmer } from "../../lib/link-prefetch";
import { listenForIntent, stopWatching, watchViewport } from "./lifecycle";
import { createPrefetchState } from "./state";
import type { PrefetchConfig } from "./types";

// No links in view by default: page data comes from the data plugin's preload, the rest on intent.
const defaultConfig: PrefetchConfig = { hoverDelay: 65, viewportBudget: 0, idleTimeout: 1200 };

/**
 * The prefetch plugin: loads a page's data through `app.data.at(path)` before the tap, so the SPA
 * finds it in the data plugin's cache. On hover, touch and focus, and for a few links in view.
 *
 * @see README.md
 */
export const prefetchPlugin = createPlugin("prefetch", {
  // data: its `at(path)` cache; spa: types the `spa:navigated` hook.
  depends: [dataPlugin, spaPlugin],
  config: defaultConfig,
  createState: createPrefetchState,
  hooks: ctx => ({
    "spa:navigated": () => {
      ctx.state.warmer?.newPage();
      watchViewport(ctx.state, ctx.config);
    }
  }),
  // Document listeners and an observer are real resources: started here, released in onStop.
  onStart: ctx => {
    const data = ctx.require(dataPlugin);
    ctx.state.warmer = createLinkWarmer({
      warm: path => data.at(path),
      here: () => location.href,
      viewportBudget: ctx.config.viewportBudget
    });
    listenForIntent(ctx.state, ctx.config);
    watchViewport(ctx.state, ctx.config);
  },
  onStop: ctx => stopWatching(ctx.state)
});
