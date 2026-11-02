/**
 * @file Small tree helpers shared by the Markdown plugins: a parent walker, hast text and the
 * parse-time hook.
 */
import type { HastNode, HastParent, MdastTransform, ProcessorLike } from "./types";

/** Any tree node the walker can descend into. */
type WalkNode = { type: string; children?: WalkNode[] | undefined };

/**
 * Call `visit` for every node with children, parents before their children.
 *
 * @param node - Root of the tree.
 * @param visit - Called with each parent node.
 * @example
 * ```ts
 * const seen: string[] = [];
 * const tree = { type: "root", children: [{ type: "paragraph", children: [{ type: "text" }] }] };
 * eachParent(tree, parent => seen.push(parent.type));
 * seen; // ["root", "paragraph"]: the text node has no children
 * ```
 */
export function eachParent<T extends WalkNode>(
  node: T,
  visit: (parent: T & { children: T[] }) => void
): void {
  const children = node.children as T[] | undefined;
  if (children === undefined) return;
  visit(node as T & { children: T[] });
  for (const child of children) eachParent(child, visit);
}

/**
 * The hast elements below `tree` that pass `test`, collected before anything is changed.
 *
 * @param tree - Root of the hast tree.
 * @param test - Which parents to collect.
 * @returns The matching parents in document order.
 * @example
 * ```ts
 * const pre: HastElement = { type: "element", tagName: "pre", properties: {}, children: [] };
 * collectParents({ type: "root", children: [pre] }, parent => parent.type === "element");
 * // [pre]: the root fails the test
 * ```
 */
export function collectParents(
  tree: HastParent,
  test: (parent: HastParent) => boolean
): HastParent[] {
  const found: HastParent[] = [];
  eachParent<HastParent | HastNode>(tree, parent => {
    if (test(parent as HastParent)) found.push(parent as HastParent);
  });
  return found;
}

/**
 * The text a reader sees in a hast node: every descendant text joined.
 *
 * @param node - A hast node.
 * @returns The concatenated text.
 * @example
 * ```ts
 * textContent({ type: "text", value: "Setup" }); // "Setup"
 * ```
 */
export function textContent(node: HastNode | HastParent): string {
  if (node.type === "text") return node.value;
  if (node.type === "element" || node.type === "root") {
    return node.children.map(child => textContent(child)).join("");
  }
  return "";
}

/**
 * Run `transform` on the mdast tree right after parsing, before every unified transformer.
 *
 * The framework adds `extraRemarkPlugins` after `remark-rehype`, so their transformers would see
 * hast. A `mdast-util-from-markdown` transform, the hook `remark-gfm` and `remark-directive` use,
 * runs on the real mdast whatever the plugin order.
 *
 * @param processor - The unified processor the plugin is attached to.
 * @param transform - The mdast transform.
 * @example
 * ```ts
 * // A remark plugin whose transform must see mdast, whatever its place in the plugin list:
 * function directives(this: ProcessorLike): void {
 *   onParse(this, transformDirectives);
 * }
 * ```
 */
export function onParse(processor: ProcessorLike, transform: MdastTransform): void {
  const data = processor.data();
  data.fromMarkdownExtensions ??= [];
  data.fromMarkdownExtensions.push({ transforms: [transform] });
}
