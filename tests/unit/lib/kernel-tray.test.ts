import { describe, expect, it } from "vitest";
import type { TrayPlugin } from "../../../src/data/tray";
import type { TrayMessages } from "../../../src/lib/kernel-errors";
import {
  appLine,
  initialHeroState,
  judgePlugin,
  plugIn,
  seedHeroState,
  trayNote,
  visibleLog
} from "../../../src/lib/kernel-tray";

const tray: TrayPlugin[] = [
  { id: "router", plugin: "router", note: "routes", glyph: "route" },
  { id: "blog", plugin: "blog", note: "posts", glyph: "page" },
  { id: "router-again", plugin: "router", note: "twice", glyph: "route" },
  { id: "auth", plugin: "auth", note: "needs session", glyph: "env", depends: "session" },
  { id: "session", plugin: "session", note: "cookies", glyph: "lifecycle" },
  { id: "start", plugin: "start", note: "a good name", glyph: "deploy" }
];

/** Stand-ins for the captured kernel messages; each names its check so a mix-up shows. */
const messages: TrayMessages = {
  duplicate: { router: "dup router", blog: "dup blog", auth: "dup auth", session: "dup session" },
  missing: { auth: "auth needs session" },
  reserved: { start: "start is reserved" }
};

const byId = (id: string): TrayPlugin => {
  const item = tray.find(entry => entry.id === id);
  if (!item) throw new Error(id);
  return item;
};

describe("judgePlugin", () => {
  // Bug: a rule is skipped or the checks run in another order than the kernel's, so the hero
  // shows a message the kernel would not print for that list.
  it("refuses a reserved name first, then a name already in, then a missing dependency", () => {
    expect(judgePlugin(byId("start"), [], messages)).toEqual({
      accepted: false,
      reason: "reserved name",
      message: "start is reserved"
    });
    expect(judgePlugin(byId("router-again"), [byId("router")], messages)).toEqual({
      accepted: false,
      reason: "duplicate",
      message: "dup router"
    });
    expect(judgePlugin(byId("auth"), [byId("router")], messages)).toEqual({
      accepted: false,
      reason: "missing session",
      message: "auth needs session"
    });
  });

  // Bug: a dependency that is already in still blocks the plugin that needs it.
  it("accepts a plugin whose dependency is already in", () => {
    expect(judgePlugin(byId("auth"), [byId("session")], messages)).toEqual({ accepted: true });
  });
});

describe("plugIn", () => {
  // Bug: an accepted plugin is not added, not locked, or logged without the plugin count.
  it("locks an accepted plugin in and logs the new plugin count", () => {
    const { state, judgement } = plugIn(initialHeroState(), "blog", tray, messages);

    expect(judgement).toEqual({ accepted: true });
    expect(state.accepted).toEqual(["blog"]);
    expect(state.verdicts.blog).toEqual({ state: "locked" });
    expect(state.log.at(-1)).toEqual({ kind: "ok", text: '"blog" locked in. plugins: 1' });
  });

  // Bug: a refused plugin sneaks into the list, or its kernel message is not logged.
  it("records a refusal with the kernel's message and counts it", () => {
    const { state } = plugIn(initialHeroState(), "start", tray, messages);

    expect(state.accepted).toEqual([]);
    expect(state.verdicts.start).toEqual({ state: "rejected", reason: "reserved name" });
    expect(state.log.at(-1)).toEqual({ kind: "error", text: "start is reserved" });
    expect(state.rejections).toBe(1);
  });

  // Bug: a locked plugin can be plugged in twice, or an unknown id throws.
  it("ignores a locked plugin and an unknown id", () => {
    const first = plugIn(initialHeroState(), "router", tray, messages).state;

    expect(plugIn(first, "router", tray, messages)).toEqual({ state: first });
    expect(plugIn(first, "nope", tray, messages)).toEqual({ state: first });
  });

  // Bug: the win line never shows, or shows again on every later plugin.
  it("logs the win line once, when the fourth plugin locks in", () => {
    let state = initialHeroState();
    for (const id of ["router", "blog", "session"]) state = plugIn(state, id, tray, messages).state;
    expect(state.log.some(line => line.kind === "win")).toBe(false);

    state = plugIn(state, "auth", tray, messages).state;
    expect(state.log.at(-1)).toEqual({
      kind: "win",
      text: "app.start() → ready. 4 plugins in, 0 slop."
    });
  });
});

describe("seedHeroState", () => {
  // Bug: the first paint does not show the duplicate refusal the hero copy promises.
  it("plugs the seed items in order: one locked in, its copy refused", () => {
    const state = seedHeroState(tray, messages, ["router", "router-again"]);

    expect(state.accepted).toEqual(["router"]);
    expect(state.verdicts["router-again"]).toEqual({ state: "rejected", reason: "duplicate" });
    expect(state.log.map(line => line.kind)).toEqual(["system", "ok", "error"]);
  });
});

describe("appLine", () => {
  // Bug: the createApp line lists tray ids instead of plugin exports.
  it("lists the accepted plugins as createApp would get them", () => {
    expect(appLine(["router", "session"], tray)).toBe(
      "createApp({ plugins: [routerPlugin, sessionPlugin] })"
    );
    expect(appLine([], tray)).toBe("createApp({ plugins: [] })");
  });
});

describe("visibleLog", () => {
  // Bug: the log grows without end and pushes the console off the screen.
  it("keeps the last six lines", () => {
    const log = Array.from({ length: 8 }, (_, index) => ({
      kind: "ok" as const,
      text: String(index)
    }));

    expect(visibleLog(log).map(line => line.text)).toEqual(["2", "3", "4", "5", "6", "7"]);
  });
});

describe("trayNote", () => {
  // Bug: a refused item keeps its old note, so the visitor never learns why.
  it("shows the note, then the verdict", () => {
    expect(trayNote(byId("auth"), undefined)).toBe("needs session");
    expect(trayNote(byId("auth"), { state: "locked" })).toBe("✓ locked in");
    expect(trayNote(byId("auth"), { state: "rejected", reason: "missing session" })).toBe(
      "✕ missing session. try again?"
    );
  });
});
