/**
 * @file Typed static params of the three docs routes, from the docs plugin.
 *
 * Browser-safe: it only reads the docs API it is handed. The docs plugin returns params as plain
 * string records; the routes need the exact shape of their pattern.
 */
import type { DocumentationApi } from "../plugins/docs/types";

/** The docs API slice the params helpers read. */
type ParametersSource = Pick<DocumentationApi, "params">;

/**
 * One param of a params record.
 *
 * @param params - A params record from the docs plugin.
 * @param key - The param name.
 * @returns Its value.
 * @throws {Error} When the record lacks the param.
 */
function requiredParameter(params: Record<string, string>, key: string): string {
  const value = params[key];
  if (value === undefined) {
    throw new Error(
      `[site] Docs params ${JSON.stringify(params)} miss "${key}".\n  Make docs.params() return the params of the route pattern.`
    );
  }
  return value;
}

/**
 * Params of `/docs/{pkg}/`: one per package home.
 *
 * @param docs - The docs plugin API.
 * @returns `{ pkg }` per package home.
 * @throws {Error} When a record lacks `pkg`.
 * @example
 * ```ts
 * route("/docs/{pkg}/").generate(ctx => packageParameters(ctx.require(docsReference)));
 * ```
 */
export async function packageParameters(docs: ParametersSource): Promise<{ pkg: string }[]> {
  const list = await docs.params(1);
  return list.map(params => ({ pkg: requiredParameter(params, "pkg") }));
}

/**
 * Params of `/docs/{pkg}/{page}/`: one per top-level page.
 *
 * @param docs - The docs plugin API.
 * @returns `{ pkg, page }` per top-level page.
 * @throws {Error} When a record lacks `pkg` or `page`.
 * @example
 * ```ts
 * route("/docs/{pkg}/{page}/").generate(ctx => pageParameters(ctx.require(docsReference)));
 * ```
 */
export async function pageParameters(
  docs: ParametersSource
): Promise<{ pkg: string; page: string }[]> {
  const list = await docs.params(2);
  return list.map(params => ({
    pkg: requiredParameter(params, "pkg"),
    page: requiredParameter(params, "page")
  }));
}

/**
 * Params of `/docs/{pkg}/{section}/{page}/`: one per page inside a section.
 *
 * @param docs - The docs plugin API.
 * @returns `{ pkg, section, page }` per section page.
 * @throws {Error} When a record lacks `pkg`, `section` or `page`.
 * @example
 * ```ts
 * route("/docs/{pkg}/{section}/{page}/").generate(ctx => sectionPageParameters(ctx.require(docsReference)));
 * ```
 */
export async function sectionPageParameters(
  docs: ParametersSource
): Promise<{ pkg: string; section: string; page: string }[]> {
  const list = await docs.params(3);
  return list.map(params => ({
    pkg: requiredParameter(params, "pkg"),
    section: requiredParameter(params, "section"),
    page: requiredParameter(params, "page")
  }));
}
