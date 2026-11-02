/**
 * @file Docs Markdown → plain Markdown for agents: directives become blockquotes, lists and
 * italic lines; fences lose their meta and their `// [!note]` comments.
 *
 * Line-based on purpose: the docs directives are block-level and written at the start of a line
 * (`./directives.ts`), and an agent needs readable Markdown, not a syntax tree. The llms plugin
 * runs every page body through it for the `.md` twins and `llms-full.txt`.
 */
import { parseFenceMeta, splitCodeLines } from "./code-blocks";

const FENCE_OPEN = /^(\s*)(`{3,}|~{3,})\s*([^\s`]*)/;
const FENCE_CLOSE = /^\s*(`{3,}|~{3,})\s*$/;
const CONTAINER_OPEN = /^\s*(:{3,})([A-Za-z][\w-]*)(?:\[([^\]]*)\])?(?:\{([^}]*)\})?\s*$/;
const CONTAINER_CLOSE = /^\s*(:{3,})\s*$/;
const LEAF = /^\s*::([A-Za-z][\w-]*)(?:\[([^\]]*)\])?(?:\{([^}]*)\})?\s*$/;
const BULLET = /^[-*+]\s+/;
const TONE_TITLES: ReadonlyMap<string, string> = new Map([
  ["neutral", "Note"],
  ["warn", "Warning"],
  ["good", "Tip"]
]);
const LIST_DIRECTIVES: ReadonlySet<string> = new Set(["steps", "flow", "gotchas"]);

/** An open container directive. */
type Frame = {
  /** Directive name. */
  name: string;
  /** Colons of its opening fence; the closing fence needs at least as many. */
  colons: number;
  /** Bullets numbered so far, for `steps`. */
  count: number;
};

/** An open code fence. */
type Fence = {
  /** Indent of the opening fence. */
  indent: string;
  /** The fence marker, e.g. three backticks. */
  marker: string;
  /** Fence language, or `""`. */
  language: string;
  /** Code lines as written. */
  body: string[];
};

/** Conversion state while the lines are read. */
type Converter = {
  /** Output lines. */
  out: string[];
  /** Open container directives, innermost last. */
  frames: Frame[];
  /** The open fence, if any. */
  fence: Fence | undefined;
};

/**
 * Write one line, quoted once per open callout.
 *
 * @param state - Conversion state.
 * @param line - The line to write.
 */
function write(state: Converter, line: string): void {
  const quote = "> ".repeat(state.frames.filter(frame => frame.name === "callout").length);
  state.out.push(line === "" ? quote.trimEnd() : `${quote}${line}`);
}

/**
 * Write a prose line; a top-level bullet directly inside `steps` gets its number.
 *
 * @param state - Conversion state.
 * @param line - The line as written.
 */
function writeProse(state: Converter, line: string): void {
  const frame = state.frames.at(-1);
  if (frame?.name === "steps" && BULLET.test(line)) {
    frame.count += 1;
    write(state, line.replace(BULLET, `${frame.count}. `));
    return;
  }
  write(state, line);
}

/**
 * Write a closed fence: language only, notes out of the code and listed after the block.
 *
 * @param state - Conversion state.
 * @param fence - The fence that just closed.
 */
function flushFence(state: Converter, fence: Fence): void {
  const { lines, notes } = splitCodeLines(fence.body.join("\n"), false);
  write(state, `${fence.indent}${fence.marker}${fence.language}`);
  for (const line of lines) write(state, line.text);
  write(state, `${fence.indent}${fence.marker}`);
  if (notes.length === 0) return;
  write(state, "");
  for (const [index, note] of notes.entries()) write(state, `${index + 1}. ${note}`);
}

/**
 * Feed one line to the open fence.
 *
 * @param state - Conversion state.
 * @param fence - The open fence.
 * @param line - The line.
 */
function readFenceLine(state: Converter, fence: Fence, line: string): void {
  const close = FENCE_CLOSE.exec(line)?.[1];
  const closes =
    close !== undefined && close[0] === fence.marker[0] && close.length >= fence.marker.length;
  if (!closes) {
    fence.body.push(line);
    return;
  }
  state.fence = undefined;
  flushFence(state, fence);
}

/**
 * Open a container directive and write its title.
 *
 * @param state - Conversion state.
 * @param match - The `CONTAINER_OPEN` match.
 */
function openContainer(state: Converter, match: RegExpExecArray): void {
  const [, colons = ":::", name = "", label, attributes] = match;
  state.frames.push({ name, colons: colons.length, count: 0 });
  let title: string | undefined;
  if (name === "callout") {
    const tone = parseFenceMeta(attributes ?? "").attributes.tone ?? "neutral";
    title = label || TONE_TITLES.get(tone);
  } else if (LIST_DIRECTIVES.has(name) && label) {
    title = label;
  }
  if (title === undefined) return;
  write(state, `**${title}**`);
  write(state, "");
}

/**
 * Read one line outside a fence.
 *
 * @param state - Conversion state.
 * @param line - The line.
 */
function readLine(state: Converter, line: string): void {
  // A code fence opens: its lines go to the fence until it closes.
  const fence = FENCE_OPEN.exec(line);
  if (fence) {
    const [, indent = "", marker = "```", language = ""] = fence;
    state.fence = { indent, marker, language, body: [] };
    return;
  }

  // A container directive closes or opens: only its fence line goes.
  const close = CONTAINER_CLOSE.exec(line)?.[1];
  const frame = state.frames.at(-1);
  if (close !== undefined && frame !== undefined && close.length >= frame.colons) {
    state.frames.pop();
    return;
  }
  const container = CONTAINER_OPEN.exec(line);
  if (container) {
    openContainer(state, container);
    return;
  }

  // A diagram becomes its caption; any other line is prose.
  const leaf = LEAF.exec(line);
  if (leaf?.[1] === "diagram") {
    const caption = leaf[2] || parseFenceMeta(leaf[3] ?? "").attributes.name || "diagram";
    write(state, `*Diagram: ${caption}*`);
    return;
  }
  writeProse(state, line);
}

/**
 * Convert docs Markdown into plain Markdown an agent reads without the site's components.
 *
 * - `:::callout{tone}` → a blockquote opening with a bold title (the `[label]`, or Note,
 *   Warning, Tip by tone).
 * - `:::steps` → its bullets numbered; `:::flow`, `:::gotchas` → the list kept; a `[label]`
 *   becomes a bold title line.
 * - `::diagram{name}` → `*Diagram: <caption or name>*`.
 * - Fences keep their language, lose their meta, and `// [!note]` comments move into a numbered
 *   list after the block.
 * - Other directives lose their fence lines and keep their content.
 *
 * @param markdown - A docs page body, kernel-errors marker already expanded.
 * @returns The converted Markdown.
 * @example
 * ```ts
 * toAgentMarkdown('::diagram{name="pipeline"}'); // "*Diagram: pipeline*"
 * ```
 */
export function toAgentMarkdown(markdown: string): string {
  const state: Converter = { out: [], frames: [], fence: undefined };
  for (const line of markdown.split("\n")) {
    if (state.fence) readFenceLine(state, state.fence, line);
    else readLine(state, line);
  }
  if (state.fence) flushFence(state, state.fence);
  return state.out.join("\n");
}
