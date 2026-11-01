/**
 * @file rehype plugin: stable, deduplicated ids on h2 and h3 headings.
 */
import type { TreeTransformer } from "./types";

/**
 * Give every h2/h3 a kebab-case id; repeats get `-2`, `-3`.
 *
 * @throws {Error} Not implemented yet.
 */
export function headingIds(): TreeTransformer {
  throw new Error("not implemented");
}

/**
 * Kebab-case slug of a heading text, the same algorithm the docs plugin uses for the TOC.
 *
 * @param _text - Heading text.
 * @throws {Error} Not implemented yet.
 */
export function headingSlug(_text: string): string {
  throw new Error("not implemented");
}
