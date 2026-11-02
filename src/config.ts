/** @file Site identity constants, the single source of truth shared by app.ts, spa.tsx and routes. */

/** Site identity. This module is reached by the browser bundle, so it stays free of node globals. */
export const SITE = {
  /** Display name (also drives the `head` title template and the Cloudflare Pages project slug). */
  name: "Moku Labs",
  /** Canonical origin. */
  url: "https://moku-labs.com",
  /** Default author. */
  author: "Oleksandr Kucherenko",
  /** Tagline used for the default meta description. */
  description: "Moku: a micro-kernel TypeScript framework family."
} as const;

/** Outbound links and agent files the site chrome points at. Not routes, so not in `urls`. */
export const LINKS = {
  /** The Moku Labs GitHub organisation. */
  github: "https://github.com/moku-labs",
  /** This site's repository; "Edit on GitHub" opens `<repository>/edit/main/<file>`. */
  repository: "https://github.com/moku-labs/site",
  /** The author's blog. */
  blog: "https://alexblog.net",
  /** The site-wide llms.txt, written by the llms plugin after the build. */
  llms: "/llms.txt",
  /** Every docs page as one Markdown file, written by the llms plugin after the build. */
  llmsFull: "/llms-full.txt"
} as const;
