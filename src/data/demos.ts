/**
 * @file The demo apps as plain data.
 */

/** One demo app built on Moku. */
export type DemoEntry = {
  /** Short id used in anchors and art file names, e.g. `timber-town`. */
  id: string;
  /** Display name, e.g. `Timber Town`. */
  name: string;
  /** One-line description. */
  description: string;
  /** Package ids the demo is built on, e.g. `["game", "editor"]`. */
  stack: readonly string[];
  /** What the demo's diorama art shows, for its `alt` text. */
  alt?: string;
  /** URL of the running demo; absent while it is not deployed. */
  live?: string;
  /** Hue of the glow behind the demo's art, in degrees. */
  hue?: number;
};

/**
 * The demos in display order.
 *
 * @example
 * ```ts
 * demos.filter(demo => demo.stack.includes("web"));
 * ```
 */
export const demos: readonly DemoEntry[] = [
  {
    id: "tracker",
    name: "Tracker",
    description: "Real-time kanban",
    stack: ["web", "worker", "common", "ci"],
    alt: "Isometric kanban board with three columns of cards",
    hue: 262
  },
  {
    id: "atlas",
    name: "Atlas",
    description: "Real-time kanban, new UI",
    stack: ["web", "worker", "common", "ci"],
    alt: "Isometric dashboard with a map grid, location pins and a sidebar",
    hue: 236
  },
  {
    id: "timber-town",
    name: "Timber Town",
    description: "Merge puzzle",
    stack: ["game", "editor", "system", "ai", "common", "ci"],
    alt: "Isometric village of small houses and round trees on a square board",
    hue: 300
  },
  {
    id: "ticktoe",
    name: "TickToe",
    description: "Tic-tac-toe in a candy toy box",
    stack: ["game", "native", "system", "ai", "common", "ci"],
    alt: "Open candy-pink toy box holding a tic-tac-toe grid of crosses and rings",
    hue: 335
  },
  {
    id: "todo",
    name: "Todo",
    description: "Offline todo for macOS/iOS",
    stack: ["web", "system", "native", "common", "ci"],
    alt: "Laptop and phone showing the same checked to-do list",
    hue: 222
  },
  {
    id: "trivia",
    name: "Trivia",
    description: "Couch party quiz",
    stack: ["web", "room", "worker", "common", "ci"],
    alt: "TV showing a quiz question with four phones as answer buttons in front",
    hue: 275
  }
];

/**
 * Why no demo uses a package yet, shown in the demos page's empty state. A package without an
 * entry gets the default line.
 *
 * @example
 * ```ts
 * demoGaps.ci ?? demoGaps.default;
 * ```
 */
export const demoGaps: Readonly<Record<string, string>> = {
  default: "It builds things the demos use. A demo of its own is on the list.",
  ci: "Every demo ships through it, though. It just does not show up in the app."
};

/** Where the demos' source code lives. */
export const demosRepository = "https://github.com/moku-labs/demos";
