/**
 * @file Types of the search plugin.
 */

/** Plugin config. */
export type SearchConfig = {
  /** Collection name the index is written to. */
  collection: string;
  /** Shard name inside the collection. */
  shard: string;
  /** Build output directory. */
  outDir: string;
};

/** Kind of a search result, shown as its label. */
export type SearchKind = "Package" | "Guide" | "Plugin" | "Concept" | "API" | "Page" | "Section";

/** One row of the ⌘K index. */
export type SearchEntry = {
  /** Result kind. */
  kind: SearchKind;
  /** Result title. */
  title: string;
  /** One-line subtitle. */
  subtitle: string;
  /** Target URL, with `#id` for sections. */
  href: string;
  /** Icon id (package id or a generic icon name). */
  icon: string;
};

/** Public API mounted at `app.search`. */
export type SearchApi = {
  /**
   * Build the index rows from docs, packages, demos and fixed pages.
   *
   * @returns Every index row.
   * @example
   * ```ts
   * const rows = await app.search.entries();
   * rows.filter(row => row.kind === "Plugin").length; // 11
   * ```
   */
  entries: () => Promise<SearchEntry[]>;
  /**
   * Persist the index as one collection shard.
   *
   * @param outputDirectory - Output directory; defaults to the configured `outDir`.
   * @returns How many rows were written.
   * @example
   * ```ts
   * const { count } = await app.search.write("dist");
   * ```
   */
  write: (outputDirectory?: string) => Promise<{ count: number }>;
};
