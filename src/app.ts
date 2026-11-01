/**
 * @file SSG composition (Node side). Opts in the Node-only plugins (build/deploy/data/cli) on top of
 * `@moku-labs/web`'s browser-safe defaults. Driven by the thin `scripts/*.ts` entries via
 * `app.cli.*`. The browser entry (src/spa.tsx) omits the Node-only plugins.
 */
import {
  buildPlugin,
  cliPlugin,
  createApp,
  dataPlugin,
  deployPlugin,
  dotenv,
  processEnv
} from "@moku-labs/web";
import { SITE } from "./config";
import { routes } from "./routes";

/**
 * The site's Node SSG app: `@moku-labs/web`'s browser-safe defaults plus the Node-only build,
 * deploy, data and cli plugins. Driven by `scripts/{build,serve,preview,deploy}.ts` via `app.cli.*`.
 *
 * @example
 * ```ts
 * import { app } from "./app";
 * await app.cli.build();
 * ```
 */
export const app = createApp({
  plugins: [buildPlugin, deployPlugin, dataPlugin, cliPlugin],
  config: { mode: "hybrid" },
  pluginConfigs: {
    site: SITE,
    i18n: { locales: ["en"], defaultLocale: "en" },
    router: { routes },
    head: { titleTemplate: `%s — ${SITE.name}` },
    build: {
      outDir: "dist",
      sitemap: true,
      injectAssets: true,
      publicDir: "public",
      // Cloudflare Pages needs dist/404.html at the output root, or it flips to SPA mode.
      notFound: { path: "src/404.html" },
      clientEntry: "src/spa.tsx",
      template: "src/index.html"
    },
    spa: { islands: [], progressBar: true },
    data: { outputDir: "_data", baseUrl: "/_data/" },
    // `ci: false`: the GitHub workflow is the thin `.github/workflows/ci.yml` caller of
    // `moku-labs/ci` app-deploy, so the deploy plugin must not scaffold a second one.
    deploy: { target: "cloudflare-pages", outDir: "dist", productionBranch: "main", ci: false },
    cli: { outDir: "dist", port: 4173 },
    // Process env first so CI secrets win; .env (gitignored) is the local fallback.
    env: { providers: [processEnv(), dotenv(".env")] }
  }
});
