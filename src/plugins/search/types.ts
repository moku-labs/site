/**
 * @file Types of the search plugin.
 */
import type { collectionPlugin, Log } from "@moku-labs/web";
import type { DemoEntry } from "../../data/demos";
import type { docsPlugin } from "../docs";
import type { DocumentPage } from "../docs/types";

/**
 * Plugin config.
 *
 * @example
 * ```ts
 * createApp({ pluginConfigs: { search: { collection: "search", shard: "en", outDir: "dist" } } });
 * ```
 */
export type SearchConfig = {
  /** Collection name the index is written to. */
  collection: string;
  /** Shard name inside the collection. */
  shard: string;
  /** Build output directory. */
  outDir: string;
};

/**
 * Kind of a search result, shown as its label.
 */
export type SearchKind = "Package" | "Guide" | "Plugin" | "Concept" | "API" | "Page" | "Section";

/**
 * One row of the ⌘K index, as the palette island reads it from the shard.
 *
 * @example
 * ```ts
 * const row: SearchEntry = { kind: "Guide", title: "Routing", subtitle: "One route table.", href: "/docs/web/guides/routing/", icon: "web" };
 * ```
 */
export type SearchEntry = {
  /** Result kind. */
  kind: SearchKind;
  /** Result title. */
  title: string;
  /** One-line subtitle; for a `Section`, the title of its page. */
  subtitle: string;
  /** Target URL, with `#id` for sections. */
  href: string;
  /** Icon id: a package id, or one of the generic names `concept`, `demo`, `page`. */
  icon: string;
};

/**
 * The fields of a package the index shows.
 */
export type SearchPackage = {
  /** Package id, e.g. `web`; its docs live at `/docs/<id>/`. */
  id: string;
  /** Display name, e.g. `@moku-labs/web`. */
  name: string;
  /** One-line tagline. */
  tagline: string;
};

/**
 * Everything the index is built from.
 */
export type SearchIndexInput = {
  /** Every docs page, in sidebar order. */
  pages: readonly DocumentPage[];
  /** The package family, in display order. */
  packages: readonly SearchPackage[];
  /** The demo apps, in display order. */
  demos: readonly DemoEntry[];
};

/**
 * Where the packages and demos come from; the defaults read `src/data/*`, tests inject their own.
 */
export type SearchSources = {
  /** The package family; called on every index build. */
  packages: () => readonly SearchPackage[];
  /** The demo apps. */
  demos: readonly DemoEntry[];
};

/**
 * The API type a plugin instance carries, read the way the kernel's `require` reads it.
 */
type PluginApiOf<Plugin> = Plugin extends { readonly _phantom: { readonly api: infer Api } }
  ? Api
  : never;

/**
 * Resolve the docs or the collection plugin to its API. A single generic signature, because the
 * framework's generic `ctx.require` is not assignable to an overload set.
 */
export type SearchRequire = <Plugin extends typeof docsPlugin | typeof collectionPlugin>(
  plugin: Plugin
) => PluginApiOf<Plugin>;

/**
 * The plugin context fields the search plugin reads; the framework's `ctx` satisfies it structurally.
 */
export type SearchContext = {
  /** Resolved plugin config. */
  readonly config: Readonly<SearchConfig>;
  /** Resolve the docs and collection plugins. */
  readonly require: SearchRequire;
  /** The core logger, for a failed write after a build. */
  readonly log: Pick<Log.LogApi, "error">;
};

/**
 * Public API mounted at `app.search`.
 */
export type SearchApi = {
  /**
   * Build the index rows: fixed pages, packages, docs pages, demos, then one `Section` per docs h2.
   * The kind of a docs page comes from its path. Each `href` appears once: a package's index page
   * becomes its `Package` row.
   *
   * @returns Every index row.
   * @throws {Error} When the docs fail to load or a package of `src/data/packages.ts` is not installed.
   * @example
   * ```ts
   * // A test checks that the routing guide's headings are reachable from ⌘K.
   * const rows = await app.search.entries();
   * rows.find(row => row.href === "/docs/web/guides/routing/#params")?.kind; // "Section"
   * ```
   */
  entries: () => Promise<SearchEntry[]>;
  /**
   * Persist the index as one collection shard, `<outDir>/<collection>/<shard>.json`.
   *
   * @param outputDirectory - Output directory; defaults to the configured `outDir`.
   * @returns How many rows were written.
   * @throws {Error} When the index cannot be built or the file cannot be written.
   * @example
   * ```ts
   * // scripts/build.ts, after app.cli.build(): the kernel does not await the build:complete hook.
   * await app.search.write(); // writes dist/search/en.json
   * (await app.search.write("preview")).count; // rows written to preview/search/en.json
   * ```
   */
  write: (outputDirectory?: string) => Promise<{ count: number }>;
};
