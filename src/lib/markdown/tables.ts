/**
 * @file rehype plugin: wrap every Markdown table in `<div data-part="table">`, the box that
 * scrolls sideways, so the table itself can stay `width: 100%`.
 */
import { collectParents } from "./tree";
import type { HastElement, HastNode, HastRoot, HastTransformer } from "./types";

/**
 * Whether a hast node is a `<table>`.
 *
 * @param node - A hast node.
 * @returns `true` for a `<table>` element.
 */
function isTable(node: HastNode): node is HastElement {
  return node.type === "element" && node.tagName === "table";
}

/**
 * Put each table of a document in its scroll box.
 *
 * @param tree - The hast tree of one document.
 */
function wrapTables(tree: HastRoot): void {
  for (const parent of collectParents(tree, node => node.children.some(isTable))) {
    parent.children = parent.children.map(child =>
      isTable(child)
        ? {
            type: "element",
            tagName: "div",
            properties: { dataPart: "table", tabIndex: 0 },
            children: [child]
          }
        : child
    );
  }
}

/**
 * rehype plugin: wrap every `<table>` in `<div data-part="table">`. The wrapper scrolls a wide
 * table inside itself; the page never scrolls sideways and a narrow table still fills the column.
 *
 * @returns The hast transformer.
 * @example
 * ```ts
 * fileSystemContent({ contentDir: "content/articles", extraRehypePlugins: [tables] });
 * ```
 */
export function tables(): HastTransformer {
  return wrapTables;
}
