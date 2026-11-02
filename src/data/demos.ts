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
  { id: "tracker", name: "Tracker", description: "Real-time kanban", stack: ["web", "worker"] },
  { id: "atlas", name: "Atlas", description: "Tracker redesign", stack: ["web", "worker"] },
  {
    id: "timber-town",
    name: "Timber Town",
    description: "Merge puzzle",
    stack: ["game", "editor"]
  },
  {
    id: "ticktoe",
    name: "TickToe",
    description: "Tic-tac-toe in a candy toy box",
    stack: ["game", "native"]
  },
  {
    id: "todo",
    name: "Todo",
    description: "Offline todo for macOS/iOS",
    stack: ["web", "system", "native"]
  },
  {
    id: "trivia",
    name: "Trivia",
    description: "Couch party quiz",
    stack: ["web", "room", "worker"]
  }
];
