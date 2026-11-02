/**
 * @file Markdown helpers of the docs plugin: TOC headings and the kernel-errors marker.
 */
import type { KernelError } from "../../lib/kernel-errors";
import { headingSlug } from "../../lib/markdown/heading-ids";
import type { DocumentHeading } from "./types";

/** The marker a page puts where the generated kernel-error list goes. */
export const KERNEL_ERRORS_MARKER = "<!-- kernel-errors -->";

const FENCE = /^\s{0,3}(`{3,}|~{3,})/;
const HEADING = /^(#{2,3})[ \t]+(.+?)(?:[ \t]+#+)?[ \t]*$/;

export { headingSlug as slugify } from "../../lib/markdown/heading-ids";

/**
 * Plain text of an inline Markdown heading: links keep their label, code and emphasis marks go.
 *
 * @param inline - Heading source after the `#` marks.
 * @returns The text a reader sees.
 * @example
 * ```ts
 * plainText("The `createApp` [call](/docs/web/)"); // "The createApp call"
 * ```
 */
function plainText(inline: string): string {
  return inline
    .replaceAll(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replaceAll(/[`*]/g, "")
    .replaceAll(/(^|\s)_+|_+(\s|$)/g, "$1$2")
    .trim();
}

/**
 * The lines of a Markdown body that are outside fenced code blocks.
 *
 * @param markdown - Page body.
 * @returns Lines outside backtick and tilde fences, fence lines dropped.
 * @example
 * ```ts
 * proseLines("a\n~~~\n## not a heading\n~~~\nb"); // ["a", "b"]
 * ```
 */
function proseLines(markdown: string): string[] {
  const lines: string[] = [];
  let fence: string | undefined;
  for (const line of markdown.split("\n")) {
    const marks = FENCE.exec(line)?.[1];
    if (marks === undefined) {
      if (fence === undefined) lines.push(line);
    } else if (fence === undefined) {
      fence = marks;
    } else if (marks[0] === fence[0] && marks.length >= fence.length) {
      fence = undefined;
    }
  }
  return lines;
}

/**
 * The h2 and h3 headings of a Markdown body, skipping fenced code, with deduplicated ids.
 *
 * @param markdown - Page body.
 * @returns Headings in document order; a repeated id gets `-2`, `-3`.
 * @example
 * ```ts
 * extractHeadings("## Setup\n### Setup");
 * // [{ id: "setup", text: "Setup", depth: 2 }, { id: "setup-2", text: "Setup", depth: 3 }]
 * ```
 */
export function extractHeadings(markdown: string): DocumentHeading[] {
  const headings: DocumentHeading[] = [];
  const seen = new Map<string, number>();
  for (const line of proseLines(markdown)) {
    const match = HEADING.exec(line);
    if (match?.[1] === undefined || match[2] === undefined) continue;
    const text = plainText(match[2]);
    const base = headingSlug(text);
    const count = (seen.get(base) ?? 0) + 1;
    seen.set(base, count);
    const id = count === 1 ? base : `${base}-${count}`;
    headings.push({ id, text, depth: match[1].length === 2 ? 2 : 3 });
  }
  return headings;
}

/**
 * Render the kernel errors as a Markdown list: id, phase, the exact message, the fix.
 *
 * @param errors - Captured kernel errors in display order.
 * @returns Markdown that replaces the marker.
 * @example
 * ```ts
 * renderKernelErrors([{ id: "dup", when: "createApp", message: "[moku] Dup.", hint: "Rename." }]);
 * // "- `dup` · checked at `createApp`\n\n  ```text\n  [moku] Dup.\n  ```\n\n  Fix: Rename."
 * ```
 */
export function renderKernelErrors(errors: readonly KernelError[]): string {
  return errors
    .map(error => {
      const message = error.message
        .split("\n")
        .map(line => `  ${line}`)
        .join("\n");
      return `- \`${error.id}\` · checked at \`${error.when}\`\n\n  \`\`\`text\n${message}\n  \`\`\`\n\n  Fix: ${error.hint}`;
    })
    .join("\n\n");
}

/**
 * Replace every kernel-errors marker with the rendered list. The capture runs only when a marker
 * is present, because it builds real apps.
 *
 * @param markdown - Page body.
 * @param capture - Resolves the kernel errors; called only when the marker is present.
 * @returns The body with the marker expanded, or the same body when it has no marker.
 * @example
 * ```ts
 * await expandKernelErrors("# Checks", async () => []); // "# Checks", capture not called
 * ```
 */
export async function expandKernelErrors(
  markdown: string,
  capture: () => Promise<readonly KernelError[]>
): Promise<string> {
  if (!markdown.includes(KERNEL_ERRORS_MARKER)) return markdown;
  const list = renderKernelErrors(await capture());
  // A replacer function: a `$&` inside a kernel message must stay literal.
  return markdown.replaceAll(KERNEL_ERRORS_MARKER, () => list);
}
