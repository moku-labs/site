/**
 * @file SSG composition (Node side). Opts in the Node-only plugins (build/deploy/data/cli, and the
 * site's docs/search/llms/og plugins, which route loaders and scripts reach) on top of
 * `@moku-labs/web`'s browser-safe defaults. Driven by the thin `scripts/*.ts` entries via
 * `app.cli.*`. The browser entry (src/spa.tsx) omits the Node-only plugins.
 */
import {
  buildPlugin,
  cliPlugin,
  collectionPlugin,
  contentPlugin,
  createApp,
  dataPlugin,
  deployPlugin,
  dotenv,
  fileSystemContent,
  processEnv
} from "@moku-labs/web";
import { OUT_DIRECTORY, SEARCH_INDEX, SITE } from "./config";
import { islands } from "./islands";
import { mokuCodeTheme } from "./lib/code-theme";
import { codeBlocks } from "./lib/markdown/code-blocks";
import { directives } from "./lib/markdown/directives";
import { headingIds } from "./lib/markdown/heading-ids";
import { tables } from "./lib/markdown/tables";
import { docsPlugin } from "./plugins/docs";
import { llmsPlugin } from "./plugins/llms";
import { ogPlugin } from "./plugins/og";
import { searchPlugin } from "./plugins/search";
import { routes } from "./routes";

/**
 * The site's Node SSG app: `@moku-labs/web`'s browser-safe defaults plus the Node-only build,
 * deploy, data and cli plugins. Driven by `scripts/{build,serve,preview,deploy}.ts` via `app.cli.*`,
 * and by `scripts/og.ts` via `app.og.write()`.
 *
 * @example
 * ```ts
 * import { app } from "./app";
 * await app.cli.build();
 * ```
 */
export const app = createApp({
  plugins: [
    contentPlugin,
    collectionPlugin,
    dataPlugin,
    buildPlugin,
    deployPlugin,
    cliPlugin,
    docsPlugin,
    searchPlugin,
    llmsPlugin,
    ogPlugin
  ],
  config: { mode: "hybrid" },
  pluginConfigs: {
    site: SITE,
    i18n: { locales: ["en"], defaultLocale: "en", ogLocaleMap: { en: "en_US" } },
    router: { routes },
    head: { titleTemplate: `%s — ${SITE.name}` },
    // Content is only the Markdown renderer for the docs plugin: no articles, no feeds.
    content: {
      providers: [
        fileSystemContent({
          contentDir: "content/articles",
          trustedContent: true,
          shikiTheme: mokuCodeTheme,
          // A fence in a language not listed here renders as plain code, with no error.
          shikiLanguages: [
            "css",
            "diff",
            "html",
            "json",
            "markdown",
            "shellscript",
            "toml",
            "tsx",
            "typescript",
            "yaml"
          ],
          extraRemarkPlugins: [directives],
          extraRehypePlugins: [headingIds, codeBlocks, tables]
        })
      ]
    },
    collection: { baseUrl: SEARCH_INDEX.baseUrl },
    docs: { dir: "content/docs" },
    search: {
      collection: SEARCH_INDEX.collection,
      shard: SEARCH_INDEX.shard,
      outDir: OUT_DIRECTORY
    },
    llms: { siteUrl: SITE.url, outDir: OUT_DIRECTORY },
    // Drawn by `bun run og` and committed: the build copies `public/og/` and never draws.
    og: { outDir: "public/og", manifest: "src/data/og-manifest.json" },
    build: {
      outDir: OUT_DIRECTORY,
      sitemap: true,
      feeds: false,
      injectAssets: true,
      publicDir: "public",
      // Cloudflare Pages needs dist/404.html at the output root, or it flips to SPA mode.
      notFound: { path: "src/404.html" },
      clientEntry: "src/spa.tsx",
      template: "src/index.html"
    },
    spa: { islands, progressBar: true },
    // One `_all.json` with every page's data: the browser loads it once, so navigation is instant.
    data: { outputDir: "_data", baseUrl: "/_data/", preload: "all" },
    // `ci: false`: the GitHub workflow is the thin `.github/workflows/ci.yml` caller of
    // `moku-labs/ci` app-deploy, so the deploy plugin must not scaffold a second one.
    deploy: {
      target: "cloudflare-pages",
      outDir: OUT_DIRECTORY,
      productionBranch: "main",
      ci: false
    },
    cli: { outDir: OUT_DIRECTORY, port: 4173 },
    // Process env first so CI secrets win; .env (gitignored) is the local fallback.
    env: { providers: [processEnv(), dotenv(".env")] }
  }
});
