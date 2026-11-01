/**
 * @file remark plugin: docs directives (`:::callout`, `:::steps`, `:::flow`, `:::gotchas`,
 * `:::diagram`) and fence meta `terminal` / `prompt` → `data-component` markup.
 */
import type { TreeTransformer } from "./types";

/**
 * Map docs directives to `data-component` markup styled by the docs components.
 *
 * @throws {Error} Not implemented yet.
 */
export function directives(): TreeTransformer {
  throw new Error("not implemented");
}
