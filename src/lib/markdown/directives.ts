/**
 * @file remark plugin: docs directives and the `terminal` / `prompt` fences → `data-component`
 * markup for the docs components.
 *
 * Syntax is the generic directive syntax `remark-directive` parses (it runs in the framework
 * pipeline):
 *
 * - `:::callout` … `:::` — neutral callout; `:::callout{tone="warn"}`, `:::callout{tone="good"}`.
 * - `:::steps`, `:::flow`, `:::gotchas` … `:::` — wrap a list.
 * - `:::name[Title]` — an optional title on any of the above.
 * - `::diagram{name="pipeline"}` — the inline SVG diagram with that name; `[caption]` optional.
 * - A fence with the flag `terminal` (`title="build"` optional) or `prompt`.
 *
 * Text after the name (`:::callout warn`) is not a directive for `remark-directive`, so a
 * paragraph that starts with `:::` fails the build instead of showing the colons. Inline
 * `:name` text directives are turned back into text, so prose like `router:navigate` stays.
 */
import { parseFenceMeta } from "./code-blocks";
import { eachParent, onParse } from "./tree";
import type { FenceMeta, HastNode, HastProperties, MdastNode, ProcessorLike } from "./types";

const CONTAINER_TAGS: ReadonlyMap<string, string> = new Map([
  ["callout", "aside"],
  ["steps", "div"],
  ["flow", "div"],
  ["gotchas", "div"]
]);
const FRAMEWORK_DIRECTIVES: ReadonlySet<string> = new Set(["pullquote", "embed", "gallery"]);
const TONES: ReadonlySet<string> = new Set(["neutral", "warn", "good"]);
/** A terminal command line; group 1 is the command without the `$` prompt. */
const COMMAND_LINE = /^\$\s?(.*)$/;
/** The kind of a terminal output line, by its first character. */
const OUTPUT_MARKERS: ReadonlyMap<string, string> = new Map([
  ["✓", "ok"],
  ["✕", "error"],
  ["✗", "error"]
]);

/**
 * An mdast text node.
 *
 * @param value - The text.
 * @returns The node.
 */
function text(value: string): MdastNode {
  return { type: "text", value };
}

/**
 * A hast text node.
 *
 * @param value - The text.
 * @returns The node.
 */
function hastText(value: string): HastNode {
  return { type: "text", value };
}

/**
 * Turn an inline `:name[label]{attributes}` back into the text it was written as.
 *
 * @param node - The `textDirective` node.
 * @returns The nodes that replace it.
 */
function restoreText(node: MdastNode): MdastNode[] {
  const nodes = [text(`:${node.name ?? ""}`)];
  const label = node.children ?? [];
  if (label.length > 0) nodes.push(text("["), ...label, text("]"));
  const attributes = Object.entries(node.attributes ?? {}).map(([key, value]) =>
    value ? `${key}="${value}"` : key
  );
  if (attributes.length > 0) nodes.push(text(`{${attributes.join(" ")}}`));
  return nodes;
}

/**
 * The tone of a callout: `neutral` unless `tone` says otherwise.
 *
 * @param node - The callout directive.
 * @returns `neutral`, `warn` or `good`.
 * @throws {Error} When `tone` is another word.
 */
function calloutTone(node: MdastNode): string {
  const tone = node.attributes?.tone ?? "neutral";
  if (!TONES.has(tone)) {
    throw new Error(
      `[site] Callout tone "${tone}" is unknown.\n  Use tone="neutral", tone="warn" or tone="good".`
    );
  }
  return tone;
}

/**
 * Mark a `::diagram{name}` directive as the diagram figure; its label becomes the caption.
 *
 * @param node - The diagram directive.
 * @throws {Error} When the directive has no `name`.
 */
function markDiagram(node: MdastNode): void {
  const name = node.attributes?.name;
  if (!name) {
    throw new Error(`[site] Diagram directive has no name.\n  Write ::diagram{name="pipeline"}.`);
  }
  node.data = {
    ...node.data,
    hName: "figure",
    hProperties: { dataComponent: "diagram", dataDiagram: name }
  };
  const caption = node.children ?? [];
  if (caption.length > 0) {
    node.children = [{ type: "paragraph", data: { hName: "figcaption" }, children: caption }];
  }
}

/**
 * Mark a container directive with its tag and `data-component`; the `[label]` becomes its title.
 *
 * @param node - A `containerDirective` or `leafDirective`.
 * @throws {Error} When the name is no docs directive and no framework directive.
 */
function markDirective(node: MdastNode): void {
  const name = node.name ?? "";
  if (name === "diagram") {
    markDiagram(node);
    return;
  }
  const tagName = CONTAINER_TAGS.get(name);
  if (tagName === undefined) {
    if (FRAMEWORK_DIRECTIVES.has(name)) return;
    throw new Error(
      `[site] Directive "${name}" is unknown.\n  Use callout, steps, flow, gotchas or diagram.`
    );
  }
  const properties: HastProperties = { dataComponent: name };
  if (name === "callout") properties.dataTone = calloutTone(node);
  node.data = { ...node.data, hName: tagName, hProperties: properties };
  const label = node.children?.[0];
  if (label?.data?.directiveLabel) label.data.hProperties = { dataPart: "title" };
}

/**
 * The kind of one terminal line: a `$` command, a `✓` line, a `✕` / `✗` line, or other output.
 *
 * @param line - The line as written.
 * @param command - The command on the line, when it is one.
 * @returns `command`, `ok`, `error` or `output`.
 */
function lineKind(line: string, command: string | undefined): string {
  if (command !== undefined) return "command";
  return OUTPUT_MARKERS.get(line.charAt(0)) ?? "output";
}

/**
 * One line of the terminal screen.
 *
 * @param kind - The line kind, for the colour.
 * @param value - The text shown; a command without its `$`.
 * @returns The `<span data-kind>` element.
 */
function screenLine(kind: string, value: string): HastNode {
  return {
    type: "element",
    tagName: "span",
    properties: { dataKind: kind },
    children: [hastText(value)]
  };
}

/**
 * The title bar of a terminal figure.
 *
 * @param title - The fence's `title` value.
 * @returns The `<figcaption data-part="title">`.
 */
function terminalTitle(title: string): HastNode {
  return {
    type: "element",
    tagName: "figcaption",
    properties: { dataPart: "title" },
    children: [hastText(title)]
  };
}

/**
 * The terminal figure for a `terminal` fence: `$` commands, `✓` / `✕` lines, other output.
 *
 * @param code - The `code` node.
 * @param meta - Its parsed meta.
 * @returns A node that becomes `<figure data-component="terminal">`.
 */
function terminalFigure(code: MdastNode, meta: FenceMeta): MdastNode {
  // Build the screen, one line per span, and collect the commands for Copy.
  const screen: HastNode[] = [];
  const commands: string[] = [];
  for (const line of (code.value ?? "").split("\n")) {
    const command = COMMAND_LINE.exec(line)?.[1];
    if (command !== undefined) commands.push(command);
    if (screen.length > 0) screen.push(hastText("\n"));
    screen.push(screenLine(lineKind(line, command), command ?? line));
  }

  // Assemble the figure: the optional title bar above the screen.
  const title = meta.attributes.title;
  const children: HastNode[] = [
    ...(title === undefined ? [] : [terminalTitle(title)]),
    {
      type: "element",
      tagName: "pre",
      properties: { dataPart: "screen", tabIndex: 0 },
      children: screen
    }
  ];
  return figure({ dataComponent: "terminal", dataCopy: commands.join("\n") }, children);
}

/**
 * The prompt bubble for a `prompt` fence.
 *
 * @param code - The `code` node.
 * @returns A node that becomes `<figure data-component="prompt">`.
 */
function promptFigure(code: MdastNode): MdastNode {
  const value = code.value ?? "";
  return figure({ dataComponent: "prompt", dataCopy: value }, [
    { type: "element", tagName: "p", properties: { dataPart: "text" }, children: [hastText(value)] }
  ]);
}

/**
 * An mdast node that `remark-rehype` turns into the given `<figure>`.
 *
 * @param properties - The figure attributes.
 * @param children - The figure's hast children.
 * @returns The mdast node.
 */
function figure(properties: HastProperties, children: HastNode[]): MdastNode {
  return {
    type: "figure",
    children: [],
    data: { hName: "figure", hProperties: properties, hChildren: children }
  };
}

/**
 * The replacement of one mdast node: directives marked, special fences turned into figures.
 *
 * @param node - A child node.
 * @returns The nodes that take its place.
 * @throws {Error} When a paragraph starts with `:::`, a directive `remark-directive` did not parse.
 */
function rewrite(node: MdastNode): MdastNode[] {
  if (node.type === "textDirective") return restoreText(node);
  if (node.type === "containerDirective" || node.type === "leafDirective") {
    markDirective(node);
    return [node];
  }
  if (node.type === "code") {
    const meta = parseFenceMeta(node.meta ?? "");
    if (meta.flags.has("terminal")) return [terminalFigure(node, meta)];
    if (meta.flags.has("prompt")) return [promptFigure(node)];
    return [node];
  }
  const first = node.type === "paragraph" ? node.children?.[0] : undefined;
  if (first?.type === "text" && first.value?.startsWith(":::")) {
    throw new Error(
      `[site] "${first.value.split("\n")[0]}" is not a directive.\n  Put attributes in braces, like :::callout{tone="warn"}.`
    );
  }
  return [node];
}

/**
 * Rewrite every directive and special fence of a document.
 *
 * @param tree - The mdast tree.
 */
function transformDirectives(tree: MdastNode): void {
  eachParent(tree, parent => {
    parent.children = parent.children.flatMap(child => rewrite(child));
  });
}

/**
 * remark plugin: docs directives (`:::callout`, `:::steps`, `:::flow`, `:::gotchas`,
 * `::diagram`) and the `terminal` / `prompt` fences → `data-component` markup. Runs on the mdast
 * at parse time, so its place in the plugin list does not matter.
 *
 * @example
 * ```ts
 * fileSystemContent({ contentDir: "content/articles", extraRemarkPlugins: [directives] });
 * ```
 */
export function directives(this: ProcessorLike): void {
  onParse(this, transformDirectives);
}
