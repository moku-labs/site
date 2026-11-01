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

/**
 * Split and parse the frontmatter of a docs file.
 *
 * @param _source - Full file contents.
 * @param _file - File path, used in error messages.
 * @throws {Error} When `title` or `description` is missing.
 */
export function parseFrontmatter(_source: string, _file: string): ParsedDocument {
  throw new Error("not implemented");
}
