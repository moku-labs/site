/**
 * @file Read the props the hero hands the `kernel-world` island through `data-props`. Pure: the
 * island passes the attribute's text.
 */
import type { TrayPlugin } from "../data/tray";
import type { TrayMessages } from "./kernel-errors";

/** What the hero hands the island through `data-props`. */
export type HeroData = {
  /** The tray in display order. */
  tray: readonly TrayPlugin[];
  /** The real kernel's messages for the tray. */
  messages: TrayMessages;
  /** Tray items plugged in before first paint. */
  seed: readonly string[];
};

/**
 * Whether a parsed value has the shape of the hero's props.
 *
 * @param value - The parsed `data-props`.
 * @returns `true` when it can drive the island.
 */
function isHeroData(value: unknown): value is HeroData {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<Record<keyof HeroData, unknown>>;
  return (
    Array.isArray(candidate.tray) &&
    Array.isArray(candidate.seed) &&
    typeof candidate.messages === "object" &&
    candidate.messages !== null
  );
}

/**
 * Parse the hero's `data-props`.
 *
 * @param json - The attribute's text; `undefined` when the hero has none.
 * @returns The props, or `undefined` when they are missing or malformed, and the island stays
 *   static.
 * @example
 * ```ts
 * parseHeroData('{"tray":[],"messages":{},"seed":[]}'); // { tray: [], messages: {}, seed: [] }
 * parseHeroData('{"tray":[]}'); // undefined: no messages and no seed
 * ```
 */
export function parseHeroData(json: string | undefined): HeroData | undefined {
  if (json === undefined) return undefined;
  try {
    const parsed: unknown = JSON.parse(json);
    return isHeroData(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}
