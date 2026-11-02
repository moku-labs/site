/**
 * @file The Moku package family as plain data: names, taglines, groups and order.
 *
 * Versions are NOT stored here. They are read from the installed packages at build
 * (`src/lib/packages.ts`), so a version on the site can never drift from npm.
 */

/** The docs group a package is listed under. */
export type PackageGroup = "Start" | "Core" | "Frameworks" | "Native" | "Game" | "Tooling";

/** One package of the family, without its version. */
export type PackageEntry = {
  /** Short id used in URLs and file names, e.g. `web`. */
  id: string;
  /** Display name, e.g. `@moku-labs/web`. */
  name: string;
  /** npm package name, or `null` when the package is not on npm (the Claude plugin). */
  npm: string | null;
  /** Version for packages that are not on npm. Ignored when `npm` is set. */
  manualVersion?: string;
  /**
   * Name the release ships under when it differs from `name`, e.g. `moku` for the Claude plugin.
   * Shown before the version: `moku 0.85.6`.
   */
  releaseName?: string;
  /** One-line tagline shown on cards and in the docs hub. */
  tagline: string;
  /** Docs group. */
  group: PackageGroup;
};

/**
 * The family in display order: the Claude plugin first, then core, frameworks, native, game and tooling.
 *
 * @example
 * ```ts
 * packages.map(entry => entry.id); // ["claude", "core", "common", "web", ...]
 * ```
 */
export const packages: readonly PackageEntry[] = [
  {
    id: "claude",
    name: "Claude plugin",
    // oxlint-disable-next-line unicorn/no-null -- not on npm
    npm: null,
    manualVersion: "0.85.6",
    releaseName: "moku",
    tagline: "A conductor in Claude Code: idea → plan → build → verify → release, on rails",
    group: "Start"
  },
  {
    id: "core",
    name: "@moku-labs/core",
    npm: "@moku-labs/core",
    tagline: "Micro-kernel plugin framework. Under 8 KB, zero dependencies.",
    group: "Core"
  },
  {
    id: "common",
    name: "@moku-labs/common",
    npm: "@moku-labs/common",
    tagline: "Shared plugins: log, env, branded CLI",
    group: "Core"
  },
  {
    id: "web",
    name: "@moku-labs/web",
    npm: "@moku-labs/web",
    tagline: "Static site + islands SPA. Same render at build and in the browser",
    group: "Frameworks"
  },
  {
    id: "worker",
    name: "@moku-labs/worker",
    npm: "@moku-labs/worker",
    tagline: "Cloudflare Workers backend. D1, KV, R2, Queues, DO — each one a plugin",
    group: "Frameworks"
  },
  {
    id: "room",
    name: "@moku-labs/room",
    npm: "@moku-labs/room",
    tagline: "Couch multiplayer. One screen, phones as controllers, no server",
    group: "Frameworks"
  },
  {
    id: "system",
    name: "@moku-labs/system",
    npm: "@moku-labs/system",
    tagline: "One system API, two runtimes. A missing capability is data, not a throw",
    group: "Native"
  },
  {
    id: "native",
    name: "@moku-labs/native",
    npm: "@moku-labs/native",
    tagline: "Compose system plugins, get installers for 5 targets",
    group: "Native"
  },
  {
    id: "game",
    name: "@moku-labs/game",
    npm: "@moku-labs/game",
    tagline: "A 2D puzzle engine where the game is a graph",
    group: "Game"
  },
  {
    id: "editor",
    name: "@moku-labs/editor",
    npm: "@moku-labs/editor",
    tagline: "Devtools for a running game: flow, state, render",
    group: "Game"
  },
  {
    id: "ai",
    name: "@moku-labs/ai",
    npm: "@moku-labs/ai",
    tagline: "Build system for AI assets. Resumable, with a cost estimate and a budget gate.",
    group: "Tooling"
  },
  {
    id: "ci",
    name: "@moku-labs/ci",
    npm: "@moku-labs/ci",
    tagline: "One CI and release pipeline. Tokenless publishing",
    group: "Tooling"
  }
];
