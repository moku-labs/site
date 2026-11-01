/**
 * @file The about page content as plain data.
 */

/** A labelled outbound link. */
export type AboutLink = {
  /** Visible label, e.g. `GitHub: moku-labs`. */
  label: string;
  /** Absolute URL. */
  href: string;
};

/** Everything the about page shows. */
export type About = {
  /** Author name. */
  name: string;
  /** One-line motto. */
  motto: string;
  /** Paragraphs of the bio. */
  bio: readonly string[];
  /** Outbound links. */
  links: readonly AboutLink[];
};

/**
 * The about content. Filled with the real text in the data wave.
 *
 * @example
 * ```ts
 * about.links.map(link => link.href);
 * ```
 */
export const about: About = { name: "", motto: "", bio: [], links: [] };
