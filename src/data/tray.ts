/**
 * @file The hero tray: six plugins "an LLM just wrote", as plain data.
 *
 * Which ones the kernel refuses is not written here. The rules are the kernel's (reserved name,
 * registered twice, missing dependency) and the words come from the real kernel at build.
 */
import type { GlyphName } from "../components/glyphs";

/** One plugin of the tray. */
export type TrayPlugin = {
  /** Unique id of the tray item; two items may carry the same plugin name. */
  id: string;
  /** The plugin name the kernel sees. */
  plugin: string;
  /** One-line note shown until the kernel has a verdict. */
  note: string;
  /** Glyph drawn on the plugin cube. */
  glyph: GlyphName;
  /** Name of the plugin it depends on. */
  depends?: string;
};

/**
 * The tray in display order.
 *
 * @example
 * ```ts
 * trayPlugins.filter(item => item.plugin === "router").length; // 2: the LLM wrote it twice
 * ```
 */
export const trayPlugins: readonly TrayPlugin[] = [
  { id: "router", plugin: "router", note: "routes and links", glyph: "route" },
  { id: "blog", plugin: "blog", note: "posts, tags, RSS", glyph: "page" },
  { id: "router-again", plugin: "router", note: "the LLM wrote it twice", glyph: "route" },
  { id: "auth", plugin: "auth", note: "needs session", glyph: "env", depends: "session" },
  { id: "session", plugin: "session", note: "cookie sessions", glyph: "lifecycle" },
  { id: "start", plugin: "start", note: "reserved name", glyph: "deploy" }
];

/**
 * Tray items plugged in before first paint, so a still frame already shows one plugin locked in
 * and one refused.
 *
 * @example
 * ```ts
 * seedHeroState(trayPlugins, messages, traySeed).accepted; // ["router"]
 * ```
 */
export const traySeed: readonly string[] = ["router", "router-again"];
