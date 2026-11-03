/**
 * @file Types of the og plugin.
 */
import type { OgObject } from "../../data/og";
import type { PackageEntry } from "../../data/packages";
import type { docsPlugin } from "../docs";
import type { DocumentationApi, DocumentPage } from "../docs/types";

/**
 * Plugin config.
 *
 * @example
 * ```ts
 * createApp({ pluginConfigs: { og: { outDir: "public/og", manifest: "src/data/og-manifest.json" } } });
 * ```
 */
export type OgConfig = {
  /**
   * Folder the PNG cards are written to. Must be `<build.publicDir>/og`: `src/lib/og-path.ts` serves
   * every card from `/og/`.
   */
  outDir: string;
  /** The JSON file that maps each card file to the hash of its drawn input. */
  manifest: string;
};

/** The meta row of a card. */
export type OgMeta = {
  /** Package name, or `concepts`. */
  name: string;
  /** Nav group of the page; absent on a package home and a concepts card. */
  section: string | undefined;
};

/**
 * Everything one card draws, and where it goes.
 *
 * @example
 * ```ts
 * const card: OgCard = {
 *   path: "/docs/concepts/events/",
 *   file: "docs/concepts/events.png",
 *   title: "Events",
 *   meta: { name: "concepts", section: undefined },
 *   line: "Typed notifications between plugins.",
 *   object: { kind: "cluster" }
 * };
 * ```
 */
export type OgCard = {
  /** URL path of the page. */
  path: string;
  /** PNG path relative to `outDir`, e.g. `docs/web.png`. */
  file: string;
  /** Card title. */
  title: string;
  /** Meta row; absent on the site pages. */
  meta: OgMeta | undefined;
  /** The line under the title, already shortened by the line rule. */
  line: string;
  /** The object on the right. */
  object: OgObject;
};

/** The fields of a docs page a card reads. */
export type OgPage = Pick<
  DocumentPage,
  "path" | "pkg" | "slug" | "section" | "group" | "title" | "description"
>;

/** Card file to the hash of its drawn input. */
export type OgManifest = Record<string, string>;

/** What a run of `write()` does with the cards and the card folder. */
export type OgPlan = {
  /** Cards with a changed input or no file: drawn in this run. */
  draw: OgCard[];
  /** Cards with a matching hash and a file: left alone. */
  keep: OgCard[];
  /** PNG files no card owns, relative to `outDir`: deleted in this run. */
  orphans: string[];
};

/**
 * The counts of one run of `write()`.
 *
 * @example
 * ```ts
 * const result: OgWriteResult = { drawn: 1, kept: 164, removed: 0 };
 * ```
 */
export type OgWriteResult = {
  /** Cards drawn in this run. */
  drawn: number;
  /** Cards left as they were. */
  kept: number;
  /** PNG files deleted because no page owns them. */
  removed: number;
};

/** Draws one card to PNG bytes. */
export type DrawCard = (card: OgCard) => Promise<Uint8Array>;

/** Where the API reads its inputs besides the docs plugin; a seam for tests. */
export type OgSources = {
  /** The package family, without versions. */
  packages: readonly PackageEntry[];
  /** Directory holding the installed packages. */
  nodeModules: string;
  /** Loads the drawing libraries and fonts; called only when a card has to be drawn. */
  createDrawer: () => Promise<DrawCard>;
};

/** The plugin context fields the og API reads; the framework's `ctx` satisfies it structurally. */
export type OgContext = {
  /** Resolved plugin config. */
  readonly config: Readonly<OgConfig>;
  /** Resolve the docs plugin to its API. */
  readonly require: (plugin: typeof docsPlugin) => Pick<DocumentationApi, "all">;
};

/** Public API mounted at `app.og`. */
export type OgApi = {
  /**
   * Every card of the site, with the words it will draw. Loads no drawing library.
   *
   * @returns One card per page: home, docs hub, demos, about and every docs page.
   * @throws {Error} When a package of the family is not installed.
   * @example
   * ```ts
   * // A test checks the committed PNG of every page without drawing one.
   * const cards = await app.og.cards();
   * cards.find(card => card.path === "/docs/web/")?.file; // "docs/web.png"
   * ```
   */
  cards: () => Promise<OgCard[]>;
  /**
   * Draw the cards whose input changed or whose file is missing, delete the PNG of a removed page,
   * and rewrite the manifest. With nothing to draw, no drawing library is loaded.
   *
   * @returns How many cards were drawn, kept and removed.
   * @throws {Error} When a card cannot be drawn. The manifest then stays as it was, so the next run draws it again.
   * @example
   * ```ts
   * // scripts/og.ts, the only caller: `bun run og` after a page changed.
   * const { drawn, kept, removed } = await app.og.write(); // 1, 164, 0
   * ```
   */
  write: () => Promise<OgWriteResult>;
};
