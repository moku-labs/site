/**
 * @file API factory of the og plugin.
 */
import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { packages } from "../../data/packages";
import { resolvePackages } from "../../lib/packages";
import { docsPlugin } from "../docs";
import { buildCards } from "./cards";
import { planCards, renderManifest } from "./manifest";
import { createCardDrawer } from "./render";
import type { OgApi, OgCard, OgContext, OgManifest, OgSources, OgWriteResult } from "./types";

/** Installed packages hold the versions and the fonts. */
const NODE_MODULES = "node_modules";

/** The real inputs. Fonts and libraries load only when a card has to be drawn. */
const defaultSources: OgSources = {
  packages,
  nodeModules: NODE_MODULES,
  createDrawer: () => createCardDrawer({ art: "public/art", nodeModules: NODE_MODULES })
};

/**
 * Every card of the site, from the docs plugin's pages and the installed family.
 *
 * @param ctx - Plugin context: `require` for the docs plugin.
 * @param sources - The family and the `node_modules` directory.
 * @returns The cards.
 * @throws {Error} When a package is not installed.
 */
async function collectCards(ctx: OgContext, sources: OgSources): Promise<OgCard[]> {
  const pages = await ctx.require(docsPlugin).all();
  return buildCards(pages, resolvePackages(sources.packages, sources.nodeModules));
}

/**
 * Read the manifest; a first run has none.
 *
 * @param file - The manifest file.
 * @returns The hashes of the last run.
 */
async function readManifest(file: string): Promise<OgManifest> {
  if (!existsSync(file)) return {};
  const manifest: OgManifest = JSON.parse(await readFile(file, "utf8"));
  return manifest;
}

/**
 * The PNG files under the card folder; a first run has none.
 *
 * @param directory - The card folder.
 * @returns Paths relative to it.
 */
async function cardFiles(directory: string): Promise<Set<string>> {
  if (!existsSync(directory)) return new Set();
  const entries = await readdir(directory, { recursive: true, withFileTypes: true });
  return new Set(
    entries
      .filter(entry => entry.isFile() && entry.name.endsWith(".png"))
      .map(entry => path.relative(directory, path.join(entry.parentPath, entry.name)))
  );
}

/**
 * Draw the cards one at a time: Satori and resvg block the thread anyway.
 *
 * @param cards - The cards to draw.
 * @param directory - The card folder.
 * @param sources - Holds the drawer factory, called only when there is a card to draw.
 */
async function drawCards(
  cards: readonly OgCard[],
  directory: string,
  sources: OgSources
): Promise<void> {
  if (cards.length === 0) return;

  const draw = await sources.createDrawer();
  for (const card of cards) {
    const target = path.join(directory, card.file);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, await draw(card));
  }
}

/**
 * Bring the card folder and the manifest in line with the pages. The manifest is written last, so
 * a card whose drawing failed is drawn again by the next run.
 *
 * @param ctx - Plugin context: config and `require` for the docs plugin.
 * @param sources - The family, `node_modules` and the drawer factory.
 * @returns The counts of the run.
 * @throws {Error} When a package is not installed or a card cannot be drawn.
 */
async function writeCards(ctx: OgContext, sources: OgSources): Promise<OgWriteResult> {
  const { outDir, manifest } = ctx.config;
  const cards = await collectCards(ctx, sources);
  const plan = planCards(cards, await readManifest(manifest), await cardFiles(outDir));

  await drawCards(plan.draw, outDir, sources);
  await Promise.all(plan.orphans.map(file => rm(path.join(outDir, file))));
  await writeFile(manifest, renderManifest(cards));

  return { drawn: plan.draw.length, kept: plan.keep.length, removed: plan.orphans.length };
}

/**
 * Build the og API. `cards()` lists the cards and draws nothing; `write()` draws what changed.
 *
 * @param ctx - Plugin context: config and `require` for the docs plugin.
 * @param sources - The family, `node_modules` and the drawer factory; defaults to the real ones.
 * @returns The API mounted at `app.og`.
 */
export function createOgApi(ctx: OgContext, sources: OgSources = defaultSources): OgApi {
  return {
    cards: () => collectCards(ctx, sources),
    write: () => writeCards(ctx, sources)
  };
}
