/**
 * @file The island registry: every interactive part of the site, registered with the SPA.
 *
 * Islands are skeleton shells until their UI wave; each one only owns behaviour, never CSS.
 */
import { createIsland } from "@moku-labs/web/browser";

/** Light/dark switch in the site and docs headers. */
export const themeToggleIsland = createIsland("theme-toggle", {});

/** Hero: the isometric kernel world, the plugin tray and kernel.log. */
export const kernelWorldIsland = createIsland("kernel-world", {});

/** Landing pyramid: core on top, packages, demos at the base, with relation highlight. */
export const pyramidIsland = createIsland("pyramid", {});

/** Landing three-layers stack: slab, step and code line stay in sync. */
export const layersStackIsland = createIsland("layers-stack", {});

/** ⌘K search palette over the search collection shard. */
export const searchPaletteIsland = createIsland("search-palette", {});

/** Code block: file tabs, copy, note hover. */
export const codeBlockIsland = createIsland("code-block", {});

/** "Copy as Markdown" on docs pages. */
export const copyPageIsland = createIsland("copy-page", {});

/** "On this page" scroll-spy. */
export const tocSpyIsland = createIsland("toc-spy", {});

/** Demos page package filter. */
export const demoFilterIsland = createIsland("demo-filter", {});

/** Every island, in registration order. */
export const islands = [
  themeToggleIsland,
  kernelWorldIsland,
  pyramidIsland,
  layersStackIsland,
  searchPaletteIsland,
  codeBlockIsland,
  copyPageIsland,
  tocSpyIsland,
  demoFilterIsland
];
