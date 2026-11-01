/**
 * @file rehype plugin: stable, deduplicated ids on h2 and h3 headings.
 */
import { textContent } from "./tree";
import type { HastElement, HastRoot, HastTransformer } from "./types";

/**
 * Kebab-case slug of a heading text, the same algorithm the docs plugin uses for the TOC.
 *
 * @param text - Heading text without Markdown.
 * @returns Lowercase slug: only `a-z`, `0-9` and dashes, runs of dashes collapsed.
 * @example
 * ```ts
 * headingSlug("Head & SEO"); // "head-seo"
 * ```
 */
export function headingSlug(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replaceAll(/[^a-z0-9 -]/g, "")
    .replaceAll(" ", "-")
    .replaceAll(/-+/g, "-");
}

/**
 * Whether a hast element is an h2 or h3.
 *
 * @param node - A hast element.
 * @returns `true` for `<h2>` and `<h3>`.
 */
function isSectionHeading(node: HastElement): boolean {
  return node.tagName === "h2" || node.tagName === "h3";
}

/**
 * Set the ids of every h2/h3 in document order; a repeated slug gets `-2`, `-3`.
 *
 * @param tree - The hast tree of one document.
 */
function addHeadingIds(tree: HastRoot): void {
  const seen = new Map<string, number>();
  for (const heading of sectionHeadings(tree)) {
    const base = headingSlug(textContent(heading));
    const count = (seen.get(base) ?? 0) + 1;
    seen.set(base, count);
    heading.properties.id = count === 1 ? base : `${base}-${count}`;
  }
}

/**
 * The h2/h3 elements of a tree in document order, also those nested in callouts or lists.
 *
 * @param node - A hast root or element.
 * @returns The headings, in the order a reader meets them.
 */
function sectionHeadings(node: HastRoot | HastElement): HastElement[] {
  return node.children.flatMap(child => {
    if (child.type !== "element") return [];
    return isSectionHeading(child) ? [child] : sectionHeadings(child);
  });
}

/**
 * rehype plugin: give every h2/h3 a kebab-case id; repeats in one document get `-2`, `-3`.
 * The ids match the TOC the docs plugin extracts from the same Markdown.
 *
 * @returns The hast transformer.
 * @example
 * ```ts
 * fileSystemContent({ contentDir: "content/articles", extraRehypePlugins: [headingIds] });
 * ```
 */
export function headingIds(): HastTransformer {
  return addHeadingIds;
}
