/**
 * @file Claude Code install commands and the landing's example prompts, as plain data.
 *
 * Node-free plain strings: the `code-block` island imports the pool to swap the landing's prompts.
 * Each docs page keeps its own prompts as ```` ```text prompt ```` blocks in its Markdown.
 */

/** The two commands that install the moku plugin in Claude Code. */
export const claudeInstallCommands: readonly string[] = [
  "/plugin marketplace add moku-labs/claude",
  "/plugin install moku@moku"
];

/** How many prompts the landing shows: the server renders the first ones, the browser swaps them. */
export const LANDING_PROMPT_COUNT = 4;

/**
 * The landing's pool of example prompts: twelve things a visitor would build, each at most 70
 * characters so it fits the two lines the landing reserves. The server renders the first four;
 * the browser swaps in four picked at random. The llms files list all of them.
 *
 * @example
 * ```ts
 * landingPrompts.slice(0, LANDING_PROMPT_COUNT); // what the server renders, before the swap
 * ```
 */
export const landingPrompts: readonly string[] = [
  "Start a Markdown blog with tags and an RSS feed",
  "Build a JSON API for a todo list on @moku-labs/worker",
  "Build a word puzzle game for phones with @moku-labs/game",
  "Ship my notes app to macOS, Windows and iOS",
  "Build a small shop with product pages and a cart",
  "Make a landing page for our company with a contact form",
  "Make a couch party game where phones are the controllers",
  "Build a docs site with a sidebar and full-text search",
  "Build a booking page where clients pick a free slot",
  "Make a team dashboard with charts from our database",
  "Generate an icon pack and a title theme with @moku-labs/ai",
  "Make a photo portfolio in English and French"
];
