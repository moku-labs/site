/**
 * @file Types of the llms plugin.
 */
import type { About } from "../../data/about";
import type { DemoEntry } from "../../data/demos";
import type { PackageEntry } from "../../data/packages";
import type { docsPlugin } from "../docs";
import type { DocumentationApi } from "../docs/types";

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

/** A page as the renderers need it: a docs page, or the landing, demos or about page. */
export type LlmsPage = {
  /** URL path of the HTML page with a trailing slash, e.g. `/docs/web/guides/routing/`. */
  path: string;
  /** Page title. */
  title: string;
  /** Page description. */
  description: string;
  /** Raw Markdown body, directives not yet converted. */
  markdown: string;
  /** Package id of a docs page; `undefined` for a site page. */
  pkg: string | undefined;
};

/** A docs page: a page that belongs to a package. */
export type LlmsDocument = LlmsPage & {
  /** Package id or `concepts`. */
  pkg: string;
};

/** What the renderers know about one docs package. */
export type LlmsPackage = {
  /** Package id or `concepts`. */
  id: string;
  /** Section heading in llms.txt, e.g. `@moku-labs/web`. */
  name: string;
  /** One-line tagline; empty when the data has none. */
  tagline: string;
  /** `npm@version` shown in the `Source:` line, e.g. `@moku-labs/web@2.4.11`. */
  release: string;
};

/** The site identity the renderers print. */
export type LlmsSite = {
  /** Site name, the llms.txt title. */
  name: string;
  /** One-line summary, the llms.txt blockquote. */
  description: string;
  /** Absolute site URL without a trailing slash. */
  url: string;
};

/** The plain data the landing, demos and about pages are generated from. */
export type SiteData = {
  /** The package family, for the landing's package list. */
  packages: readonly PackageEntry[];
  /** The demo apps. */
  demos: readonly DemoEntry[];
  /** The about page content. */
  about: About;
  /** Claude Code install commands. */
  installCommands: readonly string[];
  /** Example prompts. */
  prompts: readonly string[];
};

/** Where the API reads its inputs besides the docs plugin; a seam for tests. */
export type LlmsSources = SiteData & {
  /** Site name and summary; the URL comes from the plugin config. */
  site: Omit<LlmsSite, "url">;
  /** Directory holding the installed packages, for the versions in `Source:` lines. */
  nodeModules: string;
};

/** A write the `build:complete` hook started; `write()` for the same directory returns it. */
export type PendingWrite = {
  /** The output directory of the finished build. */
  outDir: string;
  /** The write, as `write()` returns it. */
  promise: Promise<{ count: number }>;
};

/** Plugin state. */
export type LlmsState = {
  /** The write of the last `build:complete`; replaced by the next build, dropped when it fails. */
  pending: PendingWrite | undefined;
};

/** The structural log API the hook reports a failed write to. */
export type LlmsLog = {
  /** Record an error entry. */
  error: (event: string, data?: unknown, error?: Error) => void;
};

/** The plugin context fields the llms API reads; the framework's `ctx` satisfies it structurally. */
export type LlmsContext = {
  /** Resolved plugin config. */
  readonly config: Readonly<LlmsConfig>;
  /** Mutable plugin state. */
  readonly state: LlmsState;
  /** Resolve the docs plugin to its API. */
  readonly require: (plugin: typeof docsPlugin) => Pick<DocumentationApi, "all">;
  /** The log core plugin. */
  readonly log: LlmsLog;
};

/** Public API mounted at `app.llms`. */
export type LlmsApi = {
  /**
   * Render every agent-facing file without writing it.
   *
   * @returns The `.md` pages, `llms.txt`, `llms-full.txt` and per-package `llms.txt`.
   * @throws {Error} When `siteUrl` is empty.
   * @example
   * ```ts
   * // The docs page "View as .md" link points at the file beside the HTML page.
   * const files = await app.llms.files();
   * files.some(file => file.path === "docs/web/guides/routing.md"); // true
   * ```
   */
  files: () => Promise<LlmsFile[]>;
  /**
   * Write every agent-facing file into the output directory. After a build, a call for that
   * build's output directory returns the write the `build:complete` hook started instead of
   * writing the files a second time.
   *
   * @param outputDirectory - Output directory; defaults to the configured `outDir`.
   * @returns How many files were written.
   * @throws {Error} When `siteUrl` is empty.
   * @example
   * ```ts
   * // scripts/build.ts, after the HTML build: the framework does not await build hooks.
   * await app.cli.build();
   * const { count } = await app.llms.write("dist"); // count === (await app.llms.files()).length
   * ```
   */
  write: (outputDirectory?: string) => Promise<{ count: number }>;
};
