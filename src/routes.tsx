/**
 * @file The site's single route table, used by the SSG build, the SPA and link building.
 * Imports only browser-safe modules, so it ships to the client cleanly.
 */
import { createUrls, defineRoutes, route } from "@moku-labs/web/browser";
import { SITE } from "./config";
import { HomePage } from "./pages/home-page";

/**
 * The site's route table. Shared by the SSG build (`src/app.ts`), the SPA (`src/spa.tsx`) and
 * every link (`urls`), so the three can never disagree.
 *
 * @example
 * ```ts
 * createApp({ pluginConfigs: { router: { routes } } });
 * ```
 */
export const routes = defineRoutes({
  home: route("/")
    .render(() => <HomePage />)
    .head(() => ({ title: "Hello", description: SITE.description }))
});

/**
 * Typed link builder over {@link routes}.
 *
 * @example
 * ```ts
 * const home = urls.home({}); // "/"
 * ```
 */
export const urls = createUrls(routes);
