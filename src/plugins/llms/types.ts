/**
 * @file Types of the llms plugin.
 */

/** Plugin config. */
export type LlmsConfig = {
  /** Absolute site URL used in `Source:` lines and llms.txt links. Must be set. */
  siteUrl: string;
  /** Build output directory. */
  outDir: string;
};

/** One file the plugin writes, relative to the output directory. */
export type LlmsFile = {
  /** Path relative to the output directory, e.g. `docs/web/guides/routing.md`. */
  path: string;
  /** File contents. */
  content: string;
};

/** Public API mounted at `app.llms`. */
export type LlmsApi = {
  /**
   * Render every agent-facing file without writing it.
   *
   * @returns The `.md` pages, `llms.txt`, `llms-full.txt` and per-package `llms.txt`.
   * @example
   * ```ts
   * const files = await app.llms.files();
   * files.some(file => file.path === "llms.txt"); // true
   * ```
   */
  files: () => Promise<LlmsFile[]>;
  /**
   * Write every agent-facing file into the output directory.
   *
   * @param outputDirectory - Output directory; defaults to the configured `outDir`.
   * @returns How many files were written.
   * @example
   * ```ts
   * const { count } = await app.llms.emit("dist");
   * ```
   */
  emit: (outputDirectory?: string) => Promise<{ count: number }>;
};
