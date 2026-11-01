/**
 * @file API factory of the docs plugin.
 */
import { contentPlugin } from "@moku-labs/web";
import { packages } from "../../data/packages";
import { captureKernelErrors } from "../../lib/kernel-errors";
import { loadDocuments } from "./load";
import { documentationPackageOrder } from "./tree";
import type {
  DocumentationApi,
  DocumentationContext,
  DocumentLink,
  DocumentPage,
  NavGroup
} from "./types";

/** Prev/next links of a page. */
type Neighbours = { prev?: DocumentLink; next?: DocumentLink };

/**
 * The link to a page.
 *
 * @param page - Target page.
 * @returns Its path and title.
 */
function linkTo(page: DocumentPage): DocumentLink {
  return { path: page.path, title: page.title };
}

/**
 * The route depth of a page: 1 for a package home, 2 for a top-level page, 3 inside a section.
 *
 * @param page - The page.
 * @returns Its depth.
 */
function depthOf(page: DocumentPage): 1 | 2 | 3 {
  if (page.section !== undefined) return 3;
  return page.slug === "index" ? 1 : 2;
}

/**
 * The route params of a page for its depth's route.
 *
 * @param page - The page.
 * @returns `{ pkg }`, `{ pkg, page }` or `{ pkg, section, page }`.
 */
function paramsOf(page: DocumentPage): Record<string, string> {
  if (page.section !== undefined) return { pkg: page.pkg, section: page.section, page: page.slug };
  return page.slug === "index" ? { pkg: page.pkg } : { pkg: page.pkg, page: page.slug };
}

/**
 * Sidebar groups of sorted pages, in first-seen order.
 *
 * @param pages - One package's pages in display order.
 * @returns The groups.
 */
function groupPages(pages: readonly DocumentPage[]): NavGroup[] {
  const groups = new Map<string, DocumentLink[]>();
  for (const page of pages) {
    const links = groups.get(page.group) ?? [];
    links.push(linkTo(page));
    groups.set(page.group, links);
  }
  return [...groups].map(([label, links]) => ({ label, pages: links }));
}

/**
 * The home of the nearest package in one direction that has pages: its index page, or its first
 * page when it has no index (the concepts pages have none).
 *
 * @param pages - Every page by path, in display order.
 * @param packageOrder - Package ids in display order.
 * @param pkg - The current package.
 * @param step - `-1` for the previous package, `1` for the next.
 * @returns The home page, or `undefined` past the first or last package.
 */
function neighbourHome(
  pages: ReadonlyMap<string, DocumentPage>,
  packageOrder: readonly string[],
  pkg: string,
  step: -1 | 1
): DocumentPage | undefined {
  for (let index = packageOrder.indexOf(pkg) + step; packageOrder[index]; index += step) {
    const id = packageOrder[index];
    const home = pages.get(`/docs/${id}/`) ?? [...pages.values()].find(page => page.pkg === id);
    if (home) return home;
  }
  return undefined;
}

/**
 * Prev and next of a page: its package's pages, then the neighbouring packages' homes.
 *
 * @param pages - Every page by path, in display order.
 * @param packageOrder - Package ids in display order.
 * @param path - The current page.
 * @returns The neighbours that exist; `{}` for an unknown path.
 */
function neighboursOf(
  pages: ReadonlyMap<string, DocumentPage>,
  packageOrder: readonly string[],
  path: string
): Neighbours {
  const page = pages.get(path);
  if (!page) return {};
  const own = [...pages.values()].filter(other => other.pkg === page.pkg);
  const index = own.indexOf(page);
  const previous = own[index - 1] ?? neighbourHome(pages, packageOrder, page.pkg, -1);
  const next = own[index + 1] ?? neighbourHome(pages, packageOrder, page.pkg, 1);
  const result: Neighbours = {};
  if (previous) result.prev = linkTo(previous);
  if (next) result.next = linkTo(next);
  return result;
}

/**
 * Build the docs API. Pages load once, lazily, on the first call; concurrent first calls share
 * the load, and a failed load is retried by the next call.
 *
 * @param ctx - Plugin context: config, state and `require` for the content renderer.
 * @param packageIds - Package ids in display order; defaults to `src/data/packages.ts`.
 * @returns The API mounted at `app.docs`.
 */
export function createDocumentationApi(
  ctx: DocumentationContext,
  packageIds: readonly string[] = packages.map(entry => entry.id)
): DocumentationApi {
  const packageOrder = documentationPackageOrder(packageIds);
  let pending: Promise<Map<string, DocumentPage>> | undefined;

  const load = (): Promise<Map<string, DocumentPage>> => {
    if (ctx.state.pages) return Promise.resolve(ctx.state.pages);
    pending ??= loadDocuments({
      directory: ctx.config.dir,
      packageOrder,
      render: markdown => ctx.require(contentPlugin).renderMarkdown(markdown),
      capture: () => captureKernelErrors()
    }).then(
      loaded => {
        ctx.state.pages = loaded;
        return loaded;
      },
      (error: unknown) => {
        pending = undefined;
        throw error;
      }
    );
    return pending;
  };
  const all = (): Promise<DocumentPage[]> => load().then(pages => [...pages.values()]);
  const byPackage = (pkg: string): Promise<DocumentPage[]> =>
    all().then(pages => pages.filter(page => page.pkg === pkg));

  return {
    all,
    get: path => load().then(pages => pages.get(path)),
    byPackage,
    nav: async pkg => groupPages(await byPackage(pkg)),
    neighbours: async path => neighboursOf(await load(), packageOrder, path),
    params: depth =>
      all().then(pages => pages.filter(page => depthOf(page) === depth).map(page => paramsOf(page)))
  };
}
