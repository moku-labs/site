/**
 * @file Client/SPA boot, the client bundle entry (`build.clientEntry`). Composes the browser-scoped
 * app (island hydration, intercepted navigation, the browser-only `prefetch` plugin) and starts the
 * kernel. Node-only plugins are never imported, so the bundle stays node-free.
 */
import { createApp, dataPlugin } from "@moku-labs/web/browser";
import { SITE } from "./config";
import { islands } from "./islands";
import { prefetchPlugin } from "./plugins/prefetch";
import { routes } from "./routes";

const app = createApp({
  plugins: [dataPlugin, prefetchPlugin],
  config: { mode: "hybrid" },
  pluginConfigs: {
    site: SITE,
    i18n: { locales: ["en"], defaultLocale: "en" },
    router: { routes },
    head: { titleTemplate: `%s — ${SITE.name}` },
    spa: { islands, progressBar: true },
    data: { baseUrl: "/_data/", preload: "all" }
  }
});

// Errors surfaced, not swallowed.
try {
  await app.start();
} catch (error) {
  console.error("[site] SPA boot failed", error); // @log-sink pre-boot, no ctx.log yet
}
