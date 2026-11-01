/**
 * @file Parses docs frontmatter: a YAML subset of strings, numbers and booleans.
 */

/** Frontmatter fields a docs page may set. */
export type DocumentFrontmatter = {
  /** Page title (required). */
  title: string;
  /** Page description (required). */
  description: string;
  /** Sort key inside the nav group. */
  order?: number;
  /** Nav group label. */
  section?: string;
  /** Manual drift note. */
  drift?: string;
  /** Marks a full reference page. */
  full?: boolean;
};

/** Parsed frontmatter plus the Markdown body after it. */
export type ParsedDocument = {
  /** Frontmatter fields. */
  data: DocumentFrontmatter;
  /** Markdown after the closing `---`. */
  body: string;
};

const FRONTMATTER = /^---\n([\s\S]*?)\n---(?:\n|$)/;
const NUMBER = /^-?\d+(?:\.\d+)?$/;

/**
 * Strip one pair of matching outer quotes from a scalar.
 *
 * @param value - Raw scalar text.
 * @returns The text inside the quotes, or the text unchanged.
 * @example
 * ```ts
 * unquote('"Get started"'); // "Get started"
 * ```
 */
function unquote(value: string): string {
  const quote = value.at(0);
  const quoted = value.length >= 2 && (quote === '"' || quote === "'") && value.at(-1) === quote;
  return quoted ? value.slice(1, -1) : value;
}

/**
 * Read the `key: value` lines of a frontmatter block; blank lines and `#` comments are skipped.
 *
 * @param block - Text between the `---` fences.
 * @returns Raw scalar text by key, quotes removed.
 * @example
 * ```ts
 * readFields("title: Routing\norder: 2"); // Map { "title" => "Routing", "order" => "2" }
 * ```
 */
function readFields(block: string): Map<string, string> {
  const fields = new Map<string, string>();
  for (const line of block.split("\n")) {
    const match = /^([A-Za-z][\w-]*):(.*)$/.exec(line.trim());
    if (match?.[1] !== undefined && match[2] !== undefined) {
      fields.set(match[1], unquote(match[2].trim()));
    }
  }
  return fields;
}

/**
 * Throw the frontmatter error for one field.
 *
 * @param file - File named in the message.
 * @param field - Field name.
 * @param problem - What is wrong, e.g. `is missing`.
 * @throws {Error} Always.
 */
function fail(file: string, field: string, problem: string): never {
  throw new Error(
    `[docs] ${file}: frontmatter field "${field}" ${problem}.\n  Fix the frontmatter of the file.`
  );
}

/**
 * Split and parse the frontmatter of a docs file.
 *
 * @param source - Full file contents.
 * @param file - File path, used in error messages.
 * @returns The typed fields and the Markdown body.
 * @throws {Error} When `title` or `description` is missing or empty, `order` is not a number, or `full` is not `true`/`false`.
 * @example
 * ```ts
 * parseFrontmatter("---\ntitle: Routing\ndescription: Routes.\norder: 2\n---\n# Hi", "routing.md");
 * // { data: { title: "Routing", description: "Routes.", order: 2 }, body: "# Hi" }
 * ```
 */
export function parseFrontmatter(source: string, file: string): ParsedDocument {
  const text = source.replaceAll("\r\n", "\n");
  const match = FRONTMATTER.exec(text);
  const fields = readFields(match?.[1] ?? "");
  const body = (match ? text.slice(match[0].length) : text).replace(/^\n+/, "");

  const title = fields.get("title") || fail(file, "title", "is missing");
  const description = fields.get("description") || fail(file, "description", "is missing");
  const data: DocumentFrontmatter = { title, description };

  const order = fields.get("order");
  if (order !== undefined) {
    data.order = NUMBER.test(order) ? Number(order) : fail(file, "order", "must be a number");
  }
  const full = fields.get("full");
  if (full !== undefined) {
    if (full !== "true" && full !== "false") fail(file, "full", "must be true or false");
    data.full = full === "true";
  }
  const section = fields.get("section");
  if (section) data.section = section;
  const drift = fields.get("drift");
  if (drift) data.drift = drift;
  return { data, body };
}
