/**
 * @file Read the props the hero hands the `kernel-world` island through `data-props`: the three
 * goals and the installed versions. Pure: the island passes the attribute's text.
 */
import type { Goal } from "../data/assembly";
import type { AssemblyVersions } from "./assembly";

/** What the hero hands the island through `data-props`. */
export type HeroData = {
  /** The goals in switch order; the first is the one the page shows first. */
  goals: readonly Goal[];
  /** The installed versions of core, common and the three frameworks (decision D1). */
  versions: AssemblyVersions;
};

/** The packages whose installed version the hero shows. */
const VERSION_KEYS: readonly (keyof AssemblyVersions)[] = [
  "core",
  "common",
  "web",
  "worker",
  "game"
];

/** The list fields every goal carries, which the rules walk. */
const GOAL_LISTS = ["standing", "pieces", "code", "finalCode"] as const;

/** The object fields every goal carries. */
const GOAL_OBJECTS = ["app", "framework"] as const;

/**
 * Whether a value is a plain object.
 *
 * @param value - Any parsed value.
 * @returns `true` for an object that is not `null` and not an array.
 */
function isObject(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Whether a parsed value has the shape of a goal: an id, its app and framework, and its lists.
 *
 * @param value - One parsed goal.
 * @returns `true` when the rules can read it.
 */
function isGoal(value: unknown): value is Goal {
  if (!isObject(value) || typeof value.id !== "string") return false;
  const lists = GOAL_LISTS.every(key => Array.isArray(value[key]));
  return lists && GOAL_OBJECTS.every(key => isObject(value[key]));
}

/**
 * Whether a parsed value carries a version string for every package the hero shows.
 *
 * @param value - The parsed versions.
 * @returns `true` when every version is a string.
 */
function isVersions(value: unknown): value is AssemblyVersions {
  return isObject(value) && VERSION_KEYS.every(key => typeof value[key] === "string");
}

/**
 * Parse the hero's `data-props`.
 *
 * @param json - The attribute's text; `undefined` when the hero has none.
 * @returns The props, or `undefined` when they are missing or malformed, and the hero stays at
 *   its first paint.
 * @example
 * ```ts
 * // In the island, from the hero section:
 * const data = parseHeroData(root.dataset.props);
 * data?.goals.map(goal => goal.id); // ["site", "app", "game"]
 * parseHeroData('{"goals":[]}'); // undefined: no goal and no versions
 * ```
 */
export function parseHeroData(json: string | undefined): HeroData | undefined {
  if (json === undefined) return undefined;
  try {
    const parsed: unknown = JSON.parse(json);
    if (!isObject(parsed) || !isVersions(parsed.versions)) return undefined;
    const { goals } = parsed;
    const valid = Array.isArray(goals) && goals.length > 0 && goals.every(goal => isGoal(goal));
    return valid ? { goals, versions: parsed.versions } : undefined;
  } catch {
    return undefined;
  }
}
