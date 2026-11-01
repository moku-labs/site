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
