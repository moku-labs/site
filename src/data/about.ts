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
 * The about content.
 *
 * @example
 * ```ts
 * about.links.map(link => link.href);
 * ```
 */
export const about: About = {
  name: "Alex Kucherenko",
  motto: "Software engineer. Author of Moku.",
  bio: [
    "Builds Moku: a TypeScript framework where LLM agents write most of the code and a micro-kernel checks every plugin before it runs."
  ],
  links: [
    { label: "GitHub: moku-labs", href: "https://github.com/moku-labs" },
    { label: "Blog: alexblog.net", href: "https://alexblog.net" }
  ]
};

/** One "how the lab works" card. */
export type Principle = {
  /** Card title. */
  title: string;
  /** One line under it. */
  text: string;
};

/**
 * The principles cards of the about page.
 *
 * @example
 * ```ts
 * principles.map(principle => principle.title);
 * ```
 */
export const principles: readonly Principle[] = [
  {
    title: "Agents write. The kernel reviews.",
    text: "Every plugin passes the same checks, whoever wrote it."
  },
  { title: "Docs are tested against npm.", text: "If an example breaks, the page says so." }
];

/** What the about portrait shows, for its `alt` text. */
export const portraitAlt = "Portrait: an isometric cube";
