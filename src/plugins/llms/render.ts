/**
 * @file Pure renderers for the `.md` pages, `llms.txt` and `llms-full.txt`.
 */
import type { LlmsFile } from "./types";

/** A page as the renderers need it. */
export type LlmsPage = {
  /** URL path with a trailing slash. */
  path: string;
  /** Page title. */
  title: string;
  /** Page description. */
  description: string;
  /** Raw Markdown body. */
  markdown: string;
  /** Package id the page belongs to. */
  pkg: string;
};

/**
 * Render every agent-facing file for the given pages.
 *
 * @param _pages - Pages in nav order.
 * @param _siteUrl - Absolute site URL.
 * @throws {Error} Not implemented yet.
 */
export function renderLlmsFiles(_pages: readonly LlmsPage[], _siteUrl: string): LlmsFile[] {
  throw new Error("not implemented");
}
