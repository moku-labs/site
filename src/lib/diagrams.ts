/**
 * @file Fills the `::diagram{name}` figures of a docs page with their drawing.
 *
 * The Markdown pipeline leaves `<figure data-component="diagram" data-diagram="name">` with only
 * the caption inside; this puts the named inline SVG at the top of the figure.
 */

/** A diagram figure's opening tag; group 1 is the diagram name. */
const DIAGRAM_FIGURE = /<figure data-component="diagram" data-diagram="([^"]*)">/g;

/**
 * Put each named drawing into its diagram figure, above the caption.
 *
 * @param html - Rendered page HTML.
 * @param drawings - SVG markup by diagram name.
 * @returns The HTML with every diagram drawn.
 * @throws {Error} When a figure names a diagram that has no drawing.
 * @example
 * ```ts
 * expandDiagrams(page.html, { pipeline: pipelineSvg });
 * ```
 */
export function expandDiagrams(html: string, drawings: Readonly<Record<string, string>>): string {
  return html.replaceAll(DIAGRAM_FIGURE, (figure, name: string) => {
    const drawing = Object.hasOwn(drawings, name) ? drawings[name] : undefined;
    if (drawing === undefined) {
      throw new Error(
        `[site] Diagram "${name}" has no drawing.\n  Use one of: ${Object.keys(drawings).join(", ")}.`
      );
    }
    return `${figure}${drawing}`;
  });
}
