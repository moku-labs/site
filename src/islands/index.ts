/**
 * @file The island registry: every interactive part of the site, registered with the SPA.
 *
 * One island per file in this folder; each owns behaviour only, never CSS.
 */
import { codeBlockIsland } from "./code-block";
import { copyPageIsland } from "./copy-page";
import { demoFilterIsland } from "./demo-filter";
import { kernelWorldIsland } from "./kernel-world";
import { layersStackIsland } from "./layers-stack";
import { pyramidIsland } from "./pyramid";
import { searchPaletteIsland } from "./search-palette";
import { siteNavIsland } from "./site-nav";
import { themeToggleIsland } from "./theme-toggle";
import { tocSpyIsland } from "./toc-spy";

/**
 * Every island, in registration order. Passed to `pluginConfigs.spa.islands` by both entries.
 *
 * @example
 * ```ts
 * createApp({ pluginConfigs: { spa: { islands, progressBar: true } } });
 * ```
 */
export const islands = [
  siteNavIsland,
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
