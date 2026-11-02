/**
 * @file SSG composition (Node side). Opts in the Node-only plugins (build/deploy/data/cli, and the
 * site's docs/search/llms/kernel plugins, which route loaders reach by name) on top of
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
import { SEARCH_INDEX, SITE } from "./config";
import { islands } from "./islands";
import { mokuCodeTheme } from "./lib/code-theme";
import { codeBlocks } from "./lib/markdown/code-blocks";
import { directives } from "./lib/markdown/directives";
import { headingIds } from "./lib/markdown/heading-ids";
import { tables } from "./lib/markdown/tables";
import { docsPlugin } from "./plugins/docs";
import { kernelPlugin } from "./plugins/kernel";
import { llmsPlugin } from "./plugins/llms";
import { searchPlugin } from "./plugins/search";
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
    kernelPlugin
  ],
  config: { mode: "hybrid" },
  pluginConfigs: {
    site: SITE,
    i18n: { locales: ["en"], defaultLocale: "en" },
    router: { routes },
    head: { titleTemplate: `%s — ${SITE.name}` },
    // Content is only the Markdown renderer for the docs plugin: no articles, no feeds.
    content: {
      providers: [
        fileSystemContent({
          contentDir: "content/articles",
          trustedContent: true,
          shikiTheme: mokuCodeTheme,
          extraRemarkPlugins: [directives],
          extraRehypePlugins: [headingIds, codeBlocks, tables]
        })
      ]
    },
    collection: { baseUrl: SEARCH_INDEX.baseUrl },
    docs: { dir: "content/docs" },
    search: { collection: SEARCH_INDEX.collection, shard: SEARCH_INDEX.shard, outDir: "dist" },
    llms: { siteUrl: SITE.url, outDir: "dist" },
    build: {
      outDir: "dist",
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
    data: { outputDir: "_data", baseUrl: "/_data/" },
    // `ci: false`: the GitHub workflow is the thin `.github/workflows/ci.yml` caller of
    // `moku-labs/ci` app-deploy, so the deploy plugin must not scaffold a second one.
    deploy: { target: "cloudflare-pages", outDir: "dist", productionBranch: "main", ci: false },
    cli: { outDir: "dist", port: 4173 },
    // Process env first so CI secrets win; .env (gitignored) is the local fallback.
    env: { providers: [processEnv(), dotenv(".env")] }
  }
});
