/**
 * @file From pages and data to the list of cards: the inventory A1 to A7. Pure: no file, no drawing.
 */
import type { OgObject } from "../../data/og";
import { OG_SINGLE_OBJECT, OG_SITE_CARDS } from "../../data/og";
import { ogCardFile } from "../../lib/og-path";
import type { ResolvedPackage } from "../../lib/packages";
import { cardLine } from "./text";
import type { OgCard, OgPage } from "./types";

/** Package id of the core concepts pages. */
const CONCEPTS = "concepts";

/** The drawn object of the home and concepts cards. */
const CLUSTER: OgObject = { kind: "cluster" };

/**
 * The icon of a package as the object of a card.
 *
 * @param id - Package id.
 * @returns The object.
 */
function iconOf(id: string): OgObject {
  return { kind: "art", pieces: [{ id: `icon-${id}-512`, ...OG_SINGLE_OBJECT }] };
}

/**
 * The package a page belongs to.
 *
 * @param page - A docs page.
 * @param family - The resolved family.
 * @returns The package.
 * @throws {Error} When the page's package is not in the family.
 */
function packageOf(page: OgPage, family: readonly ResolvedPackage[]): ResolvedPackage {
  const own = family.find(entry => entry.id === page.pkg);
  if (own === undefined) {
    throw new Error(
      `[site] Docs package "${page.pkg}" of ${page.path} has no share card.\n  Add it to src/data/packages.ts.`
    );
  }
  return own;
}

/**
 * The card of a concepts page: row A5.
 *
 * @param page - A concepts page.
 * @returns The card.
 */
function conceptCard(page: OgPage): OgCard {
  return {
    path: page.path,
    file: ogCardFile(page.path),
    title: page.title,
    meta: { name: CONCEPTS, version: undefined, section: undefined },
    line: cardLine(page.description),
    object: CLUSTER
  };
}

/**
 * The card of a package's docs page: row A3 for the package home, row A4 for any other page.
 *
 * @param page - A docs page of a package.
 * @param family - The resolved family.
 * @returns The card.
 * @throws {Error} When the page's package is not in the family.
 */
function packagePageCard(page: OgPage, family: readonly ResolvedPackage[]): OgCard {
  const own = packageOf(page, family);
  const isHome = page.slug === "index" && page.section === undefined;
  return {
    path: page.path,
    file: ogCardFile(page.path),
    title: isHome ? own.id : page.title,
    meta: {
      name: own.releaseName ?? own.npm ?? own.name,
      version: own.version,
      section: isHome ? undefined : page.group
    },
    line: cardLine(isHome ? own.tagline : page.description),
    object: iconOf(own.id)
  };
}

/**
 * Every card of the site: the site pages, then one per docs page.
 *
 * @param pages - Every docs page.
 * @param family - The family with installed versions.
 * @returns The cards.
 * @throws {Error} When a page's package is not in the family.
 * @example
 * ```ts
 * buildCards([], [])[0]?.file; // "home.png"
 * ```
 */
export function buildCards(pages: readonly OgPage[], family: readonly ResolvedPackage[]): OgCard[] {
  const site = OG_SITE_CARDS.map(card => ({
    ...card,
    file: ogCardFile(card.path),
    meta: undefined
  }));
  const documents = pages.map(page =>
    page.pkg === CONCEPTS ? conceptCard(page) : packagePageCard(page, family)
  );
  return [...site, ...documents];
}
