/**
 * @file Claude Code install commands and example prompts, as plain data.
 */

/** The two commands that install the moku plugin in Claude Code. */
export const claudeInstallCommands: readonly string[] = [
  "/plugin marketplace add moku-labs/claude",
  "/plugin install moku@moku"
];

/**
 * Example prompts shown on the landing and in the docs.
 *
 * @example
 * ```ts
 * claudePrompts[0]; // "Build a blog with tags and an RSS feed on @moku-labs/web"
 * ```
 */
export const claudePrompts: readonly string[] = [
  "Build a blog with tags and an RSS feed on @moku-labs/web",
  "Add a D1-backed comments API with @moku-labs/worker",
  "Make a couch quiz game: TV shows questions, phones answer",
  "Ship this app to macOS and iOS"
];
