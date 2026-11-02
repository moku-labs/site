/**
 * @file Read a `data-*` value from any element, HTML or SVG. Not an island.
 */

/**
 * The `dataset` value of an element; `undefined` for an element without a dataset or the key.
 *
 * @param element - An HTML or SVG element.
 * @param key - The camel-case dataset key, e.g. `href` for `data-href`.
 * @returns The value, if set.
 * @example
 * ```ts
 * readData(target, "layer"); // "3" for <g data-layer="3">
 * ```
 */
export function readData(element: Element | null | undefined, key: string): string | undefined {
  if (element instanceof HTMLElement || element instanceof SVGElement) return element.dataset[key];
  return undefined;
}
