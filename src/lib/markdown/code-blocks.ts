/**
 * @file rehype plugin: fence meta → `data-*` markup for file tabs, line highlights, notes and
 * diff rows.
 *
 * Fence syntax:
 *
 * - `file="src/app.ts"` — the file tab label.
 * - `group="routing"` — consecutive fences with the same group become one tabbed block.
 * - `hl="3,5-7"` — highlighted lines, counted as displayed (note-only lines removed).
 * - `// [!note] text` or `# [!note] text` — a note: taken out of the code, the line gets a numbered
 *   marker and the text goes into the list under the block. A note on its own line marks the next
 *   line.
 * - language `diff` (with `lang=ts` for the highlighting) or the flag `diff` — lines start with
 *   `+`, `-` or a space and become add / delete / context rows.
 *
 * Shiki runs after this plugin and replaces the `<pre>`, so per-line state lives in a gutter next
 * to it: `<span data-line="3" data-highlight data-diff="add" data-note="1">`.
 */
import { collectParents, eachParent, onParse, textContent } from "./tree";
import type {
  CodeLine,
  CodeLines,
  FenceMeta,
  HastElement,
  HastNode,
  HastParent,
  HastProperties,
  HastRoot,
  HastTransformer,
  MdastNode,
  ProcessorLike
} from "./types";

const META_TOKEN = /([\w-]+)(?:=(?:"([^"]*)"|'([^']*)'|(\S+)))?/g;
const LINE_RANGE = /^\s*(\d+)(?:-(\d+))?\s*$/;
const NOTE = /\s*(?:\/\/|#)\s*\[!note\]\s*(.*)$/;
const DIFF_SIGNS: ReadonlyMap<string, CodeLine["change"]> = new Map([
  ["+", "add"],
  ["-", "del"],
  [" ", undefined]
]);

/**
 * Parse a fence meta string into `key=value` attributes and bare flags.
 *
 * @param meta - Everything after the fence language.
 * @returns The attributes (quotes removed) and the flags.
 * @example
 * ```ts
 * parseFenceMeta('file="src/app.ts" check').attributes.file; // "src/app.ts"
 * ```
 */
export function parseFenceMeta(meta: string): FenceMeta {
  const attributes: Record<string, string> = {};
  const flags = new Set<string>();
  for (const [, key = "", double, single, bare] of meta.matchAll(META_TOKEN)) {
    const value = double ?? single ?? bare;
    if (value === undefined) flags.add(key);
    else attributes[key] = value;
  }
  return { attributes, flags };
}

/**
 * Parse an `hl` list such as `3,5-7` into line numbers.
 *
 * @param list - Comma-separated line numbers and ranges.
 * @param lineCount - Lines in the block; a number past it is an error.
 * @returns The highlighted line numbers.
 * @throws {Error} When a part is not a number or range, or names a line past the end.
 * @example
 * ```ts
 * parseLineList("3,5-7", 10); // Set {3, 5, 6, 7}
 * ```
 */
export function parseLineList(list: string, lineCount: number): Set<number> {
  const lines = new Set<number>();
  for (const part of list.split(",")) {
    const match = LINE_RANGE.exec(part);
    const first = Number(match?.[1]);
    const last = Number(match?.[2] ?? match?.[1]);
    if (match === null || first < 1 || last < first) {
      throw new Error(
        `[site] Code block hl="${list}" is not a line list.\n  Write line numbers and ranges, like hl="3,5-7".`
      );
    }
    if (last > lineCount) {
      throw new Error(
        `[site] Code block hl="${list}" names line ${last}, but the block shows ${lineCount} lines.\n  Count the displayed lines; note-only lines are removed.`
      );
    }
    for (let line = first; line <= last; line += 1) lines.add(line);
  }
  return lines;
}

/**
 * Take the diff sign off a line of a diff block.
 *
 * @param source - The line as written.
 * @returns The code without the sign and the row kind.
 */
function splitDiffSign(source: string): Pick<CodeLine, "text" | "change"> {
  const sign = source.slice(0, 1);
  if (!DIFF_SIGNS.has(sign)) return { text: source };
  const change = DIFF_SIGNS.get(sign);
  return change === undefined ? { text: source.slice(1) } : { text: source.slice(1), change };
}

/**
 * Split code into displayed lines: note comments out, diff signs off.
 *
 * @param code - The code without its final newline.
 * @param diff - Whether lines carry `+` / `-` / space signs.
 * @returns The displayed lines and the note texts.
 * @example
 * ```ts
 * splitCodeLines("const a = 1; // [!note] One", false);
 * // { lines: [{ text: "const a = 1;", notes: [1] }], notes: ["One"] }
 * ```
 */
export function splitCodeLines(code: string, diff: boolean): CodeLines {
  const lines: CodeLine[] = [];
  const notes: string[] = [];
  let pending: number[] = [];
  for (const source of code.split("\n")) {
    const line = diff ? splitDiffSign(source) : { text: source };
    const note = NOTE.exec(line.text);
    if (note !== null) {
      notes.push((note[1] ?? "").trim());
      pending.push(notes.length);
      line.text = line.text.slice(0, note.index).trimEnd();
      if (line.text.trim() === "") continue;
    }
    lines.push({ ...line, notes: pending });
    pending = [];
  }
  lines.at(-1)?.notes.push(...pending);
  return { lines, notes };
}

/**
 * Build a hast element.
 *
 * @param tagName - Tag name.
 * @param properties - Attributes, camelCase.
 * @param children - Child nodes.
 * @returns The element.
 */
function element(
  tagName: string,
  properties: HastProperties,
  children: HastNode[] = []
): HastElement {
  return { type: "element", tagName, properties, children };
}

/**
 * The gutter span of one line: number, highlight, diff row and note markers.
 *
 * @param line - The displayed line.
 * @param number - Line number from 1.
 * @param highlighted - Whether `hl` names the line.
 * @returns The `<span data-line>` element.
 */
function gutterLine(line: CodeLine, number: number, highlighted: boolean): HastElement {
  const properties: HastProperties = { dataLine: number };
  if (highlighted) properties.dataHighlight = true;
  if (line.change !== undefined) properties.dataDiff = line.change;
  if (line.notes.length > 0) properties.dataNote = line.notes.join(" ");
  return element("span", properties);
}

/**
 * The fence language from the `language-*` class of a `<code>`.
 *
 * @param code - The `<code>` element.
 * @returns The language, or `undefined` for a fence without one.
 */
function languageOf(code: HastElement): string | undefined {
  const classes = code.properties.className;
  const found = Array.isArray(classes)
    ? classes.find(name => String(name).startsWith("language-"))
    : undefined;
  return found === undefined ? undefined : String(found).slice("language-".length);
}

/**
 * Whether a node is the `<pre><code>` of a fenced code block.
 *
 * @param node - A hast node.
 * @returns `true` for a `<pre>` whose first child is a `<code>`.
 */
function isCodePre(node: HastNode): node is HastElement & { children: [HastElement] } {
  if (node.type !== "element" || node.tagName !== "pre") return false;
  const first = node.children[0];
  return first?.type === "element" && first.tagName === "code";
}

/**
 * The figure properties of a block: component, file, group and the text Copy takes.
 *
 * @param meta - The parsed fence meta.
 * @param lines - The displayed lines.
 * @returns The `<figure>` properties.
 * @throws {Error} When a grouped block has no `file` to label its tab.
 */
function figureProperties(meta: FenceMeta, lines: CodeLine[]): HastProperties {
  const { file, group } = meta.attributes;
  const copy = lines
    .filter(line => line.change !== "del")
    .map(line => line.text)
    .join("\n");
  const properties: HastProperties = { dataComponent: "code", dataCopy: copy };
  if (file !== undefined) properties.dataFile = file;
  if (group !== undefined) {
    if (file === undefined) {
      throw new Error(
        `[site] Code block in group "${group}" has no file.\n  Add file="…" to the fence; a tab needs a label.`
      );
    }
    properties.dataGroup = group;
  }
  return properties;
}

/**
 * Turn one `<pre><code>` into the code figure: file label, gutter, code, note list.
 *
 * @param pre - The `<pre>` of a fenced block.
 * @returns The `<figure data-component="code">`.
 */
function toFigure(pre: HastElement & { children: [HastElement] }): HastElement {
  const code = pre.children[0];
  const meta = parseFenceMeta(String(code.properties.dataMeta ?? ""));
  code.properties.dataMeta = undefined;
  const language = languageOf(code);
  if (language === "diff")
    code.properties.className = [`language-${meta.attributes.lang ?? "text"}`];
  const { lines, notes } = splitCodeLines(
    textContent(code).replace(/\n$/, ""),
    language === "diff" || meta.flags.has("diff")
  );
  const hl = meta.attributes.hl;
  const highlighted = hl === undefined ? new Set<number>() : parseLineList(hl, lines.length);
  code.children = [{ type: "text", value: `${lines.map(line => line.text).join("\n")}\n` }];

  const gutter = lines.map((line, index) =>
    gutterLine(line, index + 1, highlighted.has(index + 1))
  );
  const children: HastNode[] = [
    element("div", { dataPart: "body" }, [
      element("div", { dataPart: "gutter", ariaHidden: "true" }, gutter),
      pre
    ])
  ];
  const file = meta.attributes.file;
  if (file !== undefined) {
    children.unshift(element("figcaption", { dataPart: "file" }, [{ type: "text", value: file }]));
  }
  if (notes.length > 0) {
    const items = notes.map((text, index) =>
      element("li", { dataNote: index + 1 }, [{ type: "text", value: text }])
    );
    children.push(element("ol", { dataComponent: "code-notes" }, items));
  }
  return element("figure", figureProperties(meta, lines), children);
}

/**
 * The group name of a grouped code figure.
 *
 * @param node - A hast node.
 * @returns The `data-group` value, or `undefined` for anything else.
 */
function groupOf(node: HastNode): string | undefined {
  if (node.type !== "element" || node.properties.dataComponent !== "code") return undefined;
  const group = node.properties.dataGroup;
  return typeof group === "string" ? group : undefined;
}

/**
 * Add a figure to a tab group: a tab button with its file name, then the figure.
 *
 * @param group - The `<div data-component="code-group">`.
 * @param figure - The code figure.
 */
function addTab(group: HastElement, figure: HastElement): void {
  const tabs = group.children[0] as HastElement;
  const file = String(figure.properties.dataFile);
  const selected = tabs.children.length === 0 ? "true" : "false";
  tabs.children.push(
    element("button", { type: "button", role: "tab", dataFile: file, ariaSelected: selected }, [
      { type: "text", value: file }
    ])
  );
  group.children.push(figure);
}

/**
 * Wrap runs of figures with the same `group` (only whitespace between them) in a tab group.
 *
 * @param parent - A parent whose children include code figures.
 */
function groupTabs(parent: HastParent): void {
  const children: HastNode[] = [];
  let open: HastElement | undefined;
  for (const child of parent.children) {
    if (open !== undefined && child.type === "text" && child.value.trim() === "") continue;
    const name = groupOf(child);
    if (name === undefined) {
      open = undefined;
      children.push(child);
      continue;
    }
    if (name !== open?.properties.dataGroup) {
      open = element("div", { dataComponent: "code-group", dataGroup: name }, [
        element("div", { dataPart: "tabs", role: "tablist" })
      ]);
      children.push(open);
    }
    addTab(open, child as HastElement);
  }
  parent.children = children;
}

/**
 * Turn every fenced block of a document into a code figure, then group the tabs.
 *
 * @param tree - The hast tree of one document.
 */
function transformCodeBlocks(tree: HastRoot): void {
  for (const parent of collectParents(tree, node => node.children.some(isCodePre))) {
    parent.children = parent.children.map(child => (isCodePre(child) ? toFigure(child) : child));
    groupTabs(parent);
  }
}

/**
 * Copy each fence's meta onto a `data-meta` property, so it survives `rehype-raw` (which drops
 * the `data.meta` remark-rehype sets).
 *
 * @param tree - The mdast tree.
 */
function keepFenceMeta(tree: MdastNode): void {
  eachParent(tree, parent => {
    for (const child of parent.children) {
      if (child.type !== "code" || !child.meta) continue;
      child.data = {
        ...child.data,
        hProperties: { ...child.data?.hProperties, dataMeta: child.meta }
      };
    }
  });
}

/**
 * rehype plugin: turn fenced code blocks into `data-*` markup — file tabs, line highlights, notes
 * and diff rows. Also keeps the fence meta through `rehype-raw` with a parse-time hook.
 *
 * @returns The hast transformer.
 * @example
 * ```ts
 * fileSystemContent({ contentDir: "content/articles", extraRehypePlugins: [codeBlocks] });
 * ```
 */
export function codeBlocks(this: ProcessorLike): HastTransformer {
  onParse(this, keepFenceMeta);
  return transformCodeBlocks;
}
