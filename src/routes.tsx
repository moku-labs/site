/**
 * @file The site's single route table, used by the SSG build, the SPA and link building.
 * Imports only browser-safe modules, so it ships to the client cleanly: the docs loaders reach
 * the Node-only docs plugin through `ctx.require(docsReference)` and import their Node helpers
 * lazily, and loaders never run in the browser.
 */
import type { Router } from "@moku-labs/web/browser";
import { createUrls, defineRoutes, route } from "@moku-labs/web/browser";
import { siteLayout } from "./components/site-layout";
import { SITE } from "./config";
import type { DocumentationPageView, DocumentationParameters } from "./lib/docs-data";
import { packageParameters, pageParameters, sectionPageParameters } from "./lib/docs-params";
import { docsReference } from "./lib/docs-reference";
import { DocumentationPage } from "./pages/doc-page";
import { DocumentationHubPage } from "./pages/docs-hub-page";
import { HomePage } from "./pages/home-page";
import { PlaceholderPage } from "./pages/placeholder-page";

/**
 * The build-time docs loaders. A lazy import keeps their Node code out of the client bundle.
 *
 * @returns The `src/lib/docs-data` module.
 */
const docsData = () => import("./lib/docs-data");

/** The part of a docs route's load context the docs loader reads. */
type DocumentationLoadContext = {
  /** Route params of the docs page. */
  readonly params: DocumentationParameters;
  /** Resolves the docs plugin through {@link docsReference}. */
  readonly require: Router.RouteRequire;
};

/**
 * Load one docs page at build: the page, its sidebar, prev/next and package.
 *
 * @param ctx - The route's load context.
 * @returns The page view, also written as the page's data sidecar.
 */
async function loadDocumentationPage(
  ctx: DocumentationLoadContext
): Promise<DocumentationPageView> {
  const data = await docsData();
  return data.loadDocumentationPage(
    ctx.require(docsReference),
    ctx.params,
    data.installedSources()
  );
}

/**
 * Head of a docs page: its title and description.
 *
 * @param ctx - The route's render context.
 * @param ctx.data - The page view.
 * @returns The head fields.
 */
function docsPageHead(ctx: { data: DocumentationPageView }): {
  title: string;
  description: string;
} {
  return { title: ctx.data.headTitle, description: ctx.data.page.description };
}

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
    .layout(siteLayout)
    .render(() => <HomePage />)
    .head(() => ({ title: SITE.name, description: SITE.description }))
    .meta({ nav: "home" }),
  docsHub: route("/docs/")
    .layout(siteLayout)
    .load(async ctx => {
      const data = await docsData();
      return data.loadDocumentationHub(ctx.require(docsReference), data.installedSources());
    })
    .render(ctx => <DocumentationHubPage view={ctx.data} />)
    .head(() => ({
      title: "Docs",
      description: "Docs for every Moku package, checked against the published releases."
    }))
    .meta({ nav: "docs" }),
  docsPackage: route("/docs/{pkg}/")
    .layout(siteLayout)
    .generate(ctx => packageParameters(ctx.require(docsReference)))
    .load(loadDocumentationPage)
    .render(ctx => <DocumentationPage view={ctx.data} url={ctx.url} />)
    .head(docsPageHead)
    .meta({ nav: "docs" }),
  docsPage: route("/docs/{pkg}/{page}/")
    .layout(siteLayout)
    .generate(ctx => pageParameters(ctx.require(docsReference)))
    .load(loadDocumentationPage)
    .render(ctx => <DocumentationPage view={ctx.data} url={ctx.url} />)
    .head(docsPageHead)
    .meta({ nav: "docs" }),
  docsDeep: route("/docs/{pkg}/{section}/{page}/")
    .layout(siteLayout)
    .generate(ctx => sectionPageParameters(ctx.require(docsReference)))
    .load(loadDocumentationPage)
    .render(ctx => <DocumentationPage view={ctx.data} url={ctx.url} />)
    .head(docsPageHead)
    .meta({ nav: "docs" }),
  demos: route("/demos/")
    .layout(siteLayout)
    .render(() => <PlaceholderPage name="demos" title="Demos" />)
    .head(() => ({ title: "Demos", description: SITE.description }))
    .meta({ nav: "demos" }),
  about: route("/about/")
    .layout(siteLayout)
    .render(() => <PlaceholderPage name="about" title="About" />)
    .head(() => ({ title: "About", description: SITE.description }))
    .meta({ nav: "about" })
});

/**
 * Typed link builder over {@link routes}.
 *
 * @example
 * ```ts
 * urls.toUrl("docsPage", { pkg: "web", page: "quick-start" }); // "/docs/web/quick-start/"
 * ```
 */
export const urls = createUrls(routes);
