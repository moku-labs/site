/**
 * @file The head fields of each route type: card, Open Graph tags and JSON-LD. Browser-safe:
 * `src/routes.tsx` calls it, also in the browser on client navigation. Elements are built with the
 * framework's `og()`, `twitter()` and `jsonLd()`, which escape their values.
 */
import type { Head } from "@moku-labs/web/browser";
import { jsonLd, og, twitter } from "@moku-labs/web/browser";
import { LINKS, SITE } from "../config";
import type { DocumentationPageView } from "./docs-data";
import { OG_IMAGE_SIZE, ogImagePath } from "./og-path";

/** The schema.org context every JSON-LD object names. */
const SCHEMA_CONTEXT = "https://schema.org";

/** URL path of the docs hub, the second crumb of every docs page. */
const DOCS_PATH = "/docs/";

/** The `og:type` of a page. */
type PageType = "website" | "article";

/** One step of a breadcrumb. */
type Crumb = {
  /** Visible name. */
  name: string;
  /** URL path. */
  path: string;
};

/** The fields of a site page the head reads. */
export type SitePageInput = {
  /** URL path with its trailing slash. */
  path: string;
  /** Page title before the site template. */
  title: string;
  /** Full description. */
  description: string;
};

/** The parts of a docs page view the head reads. */
export type DocumentationHeadInput = Pick<DocumentationPageView, "headTitle"> & {
  /** The page. */
  page: Pick<DocumentationPageView["page"], "path" | "title" | "description">;
  /** The page's package: `home` is absent when the package has no docs home. */
  package: Pick<DocumentationPageView["package"], "name" | "home">;
};

/**
 * The absolute URL of a page, written the way the framework writes its canonical link.
 *
 * @param pagePath - URL path.
 * @returns The bare origin for the site root, otherwise origin and path.
 */
function absoluteUrl(pagePath: string): string {
  return pagePath === "/" ? SITE.url : `${SITE.url}${pagePath}`;
}

/**
 * The Open Graph and Twitter tags the framework does not write from the `image` field.
 *
 * @param type - The `og:type`.
 * @param alt - What the card shows.
 * @returns The elements.
 */
function cardElements(type: PageType, alt: string): Head.HeadElement[] {
  return [
    og("og:type", type),
    og("og:site_name", SITE.name),
    og("og:image:width", String(OG_IMAGE_SIZE.width)),
    og("og:image:height", String(OG_IMAGE_SIZE.height)),
    og("og:image:alt", alt),
    twitter("twitter:image:alt", alt)
  ];
}

/**
 * The BreadcrumbList JSON-LD of a page.
 *
 * @param crumbs - The steps from the site root to the page.
 * @returns The element.
 */
function breadcrumbs(crumbs: readonly Crumb[]): Head.HeadElement {
  return jsonLd({
    "@context": SCHEMA_CONTEXT,
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((crumb, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: crumb.name,
      item: absoluteUrl(crumb.path)
    }))
  });
}

/**
 * Whether a package's home is a real page other than the one being described, so a crumb can link
 * it. Concepts has no home, and a package home does not list itself twice.
 *
 * @param home - URL path of the package's home, when it has one.
 * @param pagePath - URL path of the page.
 * @returns `true` when the home deserves its own crumb.
 */
function isOtherHome(home: string | undefined, pagePath: string): home is string {
  return home !== undefined && home !== pagePath;
}

/**
 * The head of the home page: the site and the organisation, with its keyed title.
 *
 * @returns The head fields.
 * @example
 * ```ts
 * homeHead().image; // "/og/home.png"
 * ```
 */
export function homeHead(): Head.HeadConfig {
  return {
    title: SITE.name,
    description: SITE.description,
    image: ogImagePath("/"),
    elements: [
      // The keyed `title` element pins the tab title past the `%s — Moku Labs` template.
      { tag: "title", children: SITE.name, key: "title" },
      ...cardElements("website", SITE.name),
      jsonLd({
        "@context": SCHEMA_CONTEXT,
        "@type": "WebSite",
        name: SITE.name,
        url: SITE.url,
        description: SITE.description
      }),
      jsonLd({
        "@context": SCHEMA_CONTEXT,
        "@type": "Organization",
        name: SITE.name,
        url: SITE.url,
        sameAs: [LINKS.github]
      })
    ]
  };
}

/**
 * The head of a site page with no docs behind it: the docs hub, demos and about.
 *
 * @param input - The page.
 * @returns The head fields.
 * @example
 * ```ts
 * sitePageHead({ path: "/demos/", title: "Demos", description: "Six apps." }).image; // "/og/demos.png"
 * ```
 */
export function sitePageHead(input: SitePageInput): Head.HeadConfig {
  const { path, title, description } = input;
  return {
    title,
    description,
    image: ogImagePath(path),
    elements: [
      ...cardElements("website", `${title}, ${SITE.name}`),
      breadcrumbs([
        { name: SITE.name, path: "/" },
        { name: title, path }
      ])
    ]
  };
}

/**
 * The head of a docs page. A package home does not list itself twice, and a package without a home
 * (concepts) has no crumb: only real pages are linked.
 *
 * @param view - The page view of the docs route.
 * @returns The head fields.
 * @example
 * ```ts
 * const page = { path: "/docs/web/", title: "@moku-labs/web", description: "The web package." };
 * const pkg = { name: "@moku-labs/web", home: "/docs/web/" };
 * documentationHead({ headTitle: page.title, page, package: pkg }).image; // "/og/docs/web.png"
 * ```
 */
export function documentationHead(view: DocumentationHeadInput): Head.HeadConfig {
  const { headTitle, page, package: own } = view;
  const image = ogImagePath(page.path);
  const packageCrumbs = isOtherHome(own.home, page.path)
    ? [{ name: own.name, path: own.home }]
    : [];
  return {
    title: headTitle,
    description: page.description,
    image,
    elements: [
      ...cardElements("article", `${headTitle}, ${SITE.name} docs`),
      jsonLd({
        "@context": SCHEMA_CONTEXT,
        "@type": "TechArticle",
        headline: page.title,
        description: page.description,
        url: absoluteUrl(page.path),
        image: absoluteUrl(image),
        author: { "@type": "Person", name: SITE.author },
        publisher: { "@type": "Organization", name: SITE.name, url: SITE.url }
      }),
      breadcrumbs([
        { name: SITE.name, path: "/" },
        { name: "Docs", path: DOCS_PATH },
        ...packageCrumbs,
        { name: page.title, path: page.path }
      ])
    ]
  };
}
