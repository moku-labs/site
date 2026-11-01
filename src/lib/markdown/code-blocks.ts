/**
 * @file rehype plugin: fence meta → `data-*` attributes for file tabs, line highlights,
 * notes and diff rows.
 */
import type { TreeTransformer } from "./types";

/**
 * Turn fence meta (`file=`, `group=`, `hl=`, `// [!note]` comments, `diff`) into markup.
 *
 * @throws {Error} Not implemented yet.
 */
export function codeBlocks(): TreeTransformer {
  throw new Error("not implemented");
}
