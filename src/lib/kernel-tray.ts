/**
 * @file The hero's kernel, replayed: which tray plugins it accepts, what it logs, what the tray
 * shows. A pure reducer, so the SSR first paint and the `kernel-world` island agree.
 *
 * The rules mirror the kernel's own order of checks (reserved name, registered twice, missing
 * dependency). The words are never typed here: they are the real kernel's messages, captured at
 * build by `captureTrayMessages` and handed to the island through `data-props`.
 */
import type { TrayPlugin } from "../data/tray";
import type { TrayMessages } from "./kernel-errors";

/** What the kernel says about one plugin. */
export type Judgement =
  | {
      /** The plugin locks in. */
      accepted: true;
    }
  | {
      /** The plugin is refused. */
      accepted: false;
      /** Short reason for the tray, e.g. `missing session`. */
      reason: string;
      /** The kernel's exact message for the log. */
      message: string;
    };

/** The tray state of one item after the kernel saw it. */
export type TrayVerdict =
  | {
      /** Accepted and locked in. */
      state: "locked";
    }
  | {
      /** Refused; it can be tried again. */
      state: "rejected";
      /** Short reason shown on the item. */
      reason: string;
    };

/** Kind of a kernel.log line. */
export type LogKind = "system" | "ok" | "error" | "win";

/** One kernel.log line. */
export type LogLine = {
  /** Line kind, drives the marker and colour. */
  kind: LogKind;
  /** Line text; an error is the kernel's message, two lines. */
  text: string;
};

/** Everything the hero shows. */
export type HeroState = {
  /** Accepted tray item ids, in plug-in order (the socket order). */
  accepted: readonly string[];
  /** Verdict per tray item id. */
  verdicts: Readonly<Record<string, TrayVerdict>>;
  /** Every log line so far. */
  log: readonly LogLine[];
  /** Number of refusals so far; refused plugins fall off alternating edges. */
  rejections: number;
};

/** The line the kernel starts with. */
const READY_LINE: LogLine = { kind: "system", text: "kernel ready. waiting for plugins." };

/** Accepted plugins it takes to start the app. */
const PLUGINS_TO_START = 4;

/** Lines kernel.log shows. */
const LOG_SIZE = 6;

/**
 * The empty hero: no plugin in, the ready line logged.
 *
 * @returns A fresh state.
 * @example
 * ```ts
 * // The Reset button:
 * render(initialHeroState());
 * ```
 */
export function initialHeroState(): HeroState {
  return { accepted: [], verdicts: {}, log: [READY_LINE], rejections: 0 };
}

/**
 * Judge one tray plugin against the plugins already in, in the kernel's order of checks.
 *
 * @param item - The plugin dropped on the kernel.
 * @param accepted - Plugins already in.
 * @param messages - The kernel's captured messages.
 * @returns Accepted, or refused with a short reason and the kernel's message.
 * @example
 * ```ts
 * judgePlugin(start, [], messages); // { accepted: false, reason: "reserved name", message: "[web] Plugin name \"start\" …" }
 * ```
 */
export function judgePlugin(
  item: TrayPlugin,
  accepted: readonly TrayPlugin[],
  messages: TrayMessages
): Judgement {
  const reserved = messages.reserved[item.plugin];
  if (reserved !== undefined)
    return { accepted: false, reason: "reserved name", message: reserved };
  if (accepted.some(other => other.plugin === item.plugin)) {
    return { accepted: false, reason: "duplicate", message: messages.duplicate[item.plugin] ?? "" };
  }
  if (item.depends !== undefined && !accepted.some(other => other.plugin === item.depends)) {
    return {
      accepted: false,
      reason: `missing ${item.depends}`,
      message: messages.missing[item.plugin] ?? ""
    };
  }
  return { accepted: true };
}

/**
 * The tray items of a list of ids, in that order.
 *
 * @param ids - Tray item ids.
 * @param tray - The whole tray.
 * @returns The items that exist.
 */
function itemsOf(ids: readonly string[], tray: readonly TrayPlugin[]): TrayPlugin[] {
  return ids.flatMap(id => tray.filter(item => item.id === id));
}

/**
 * Drop one tray plugin on the kernel: judge it and return the next state. A locked item or an
 * unknown id changes nothing and returns no judgement.
 *
 * @param state - The current state.
 * @param id - Tray item id.
 * @param tray - The whole tray.
 * @param messages - The kernel's captured messages.
 * @returns The next state and, when the kernel judged, its judgement.
 * @example
 * ```ts
 * const { state: next, judgement } = plugIn(state, "auth", trayPlugins, messages);
 * if (judgement?.accepted === false) shakeKernel();
 * ```
 */
export function plugIn(
  state: HeroState,
  id: string,
  tray: readonly TrayPlugin[],
  messages: TrayMessages
): { state: HeroState; judgement?: Judgement } {
  const item = tray.find(entry => entry.id === id);
  if (item === undefined || state.verdicts[id]?.state === "locked") return { state };
  const judgement = judgePlugin(item, itemsOf(state.accepted, tray), messages);
  if (!judgement.accepted) {
    return {
      judgement,
      state: {
        ...state,
        verdicts: { ...state.verdicts, [id]: { state: "rejected", reason: judgement.reason } },
        log: [...state.log, { kind: "error", text: judgement.message }],
        rejections: state.rejections + 1
      }
    };
  }
  const accepted = [...state.accepted, id];
  const log: LogLine[] = [
    ...state.log,
    { kind: "ok", text: `"${item.plugin}" locked in. plugins: ${accepted.length}` }
  ];
  if (accepted.length === PLUGINS_TO_START) {
    log.push({ kind: "win", text: `app.start() → ready. ${accepted.length} plugins in, 0 slop.` });
  }
  return {
    judgement,
    state: { ...state, accepted, verdicts: { ...state.verdicts, [id]: { state: "locked" } }, log }
  };
}

/**
 * The first paint: the seed items plugged in, in order, on an empty hero.
 *
 * @param tray - The whole tray.
 * @param messages - The kernel's captured messages.
 * @param seed - Tray item ids to plug in.
 * @returns The seeded state.
 * @example
 * ```ts
 * seedHeroState(trayPlugins, messages, traySeed).accepted; // ["router"]
 * ```
 */
export function seedHeroState(
  tray: readonly TrayPlugin[],
  messages: TrayMessages,
  seed: readonly string[]
): HeroState {
  let state = initialHeroState();
  for (const id of seed) state = plugIn(state, id, tray, messages).state;
  return state;
}

/**
 * The live `createApp` line of kernel.log.
 *
 * @param accepted - Accepted tray item ids.
 * @param tray - The whole tray.
 * @returns `createApp({ plugins: [routerPlugin, …] })`.
 * @example
 * ```ts
 * appLine(["router"], trayPlugins); // "createApp({ plugins: [routerPlugin] })"
 * ```
 */
export function appLine(accepted: readonly string[], tray: readonly TrayPlugin[]): string {
  const plugins = itemsOf(accepted, tray).map(item => `${item.plugin}Plugin`);
  return `createApp({ plugins: [${plugins.join(", ")}] })`;
}

/**
 * The lines kernel.log shows: the last six.
 *
 * @param log - Every line so far.
 * @returns The visible lines, oldest first.
 * @example
 * ```ts
 * visibleLog(state.log).length; // at most 6
 * ```
 */
export function visibleLog(log: readonly LogLine[]): readonly LogLine[] {
  return log.slice(-LOG_SIZE);
}

/**
 * The line under a tray item: its note until the kernel has a verdict.
 *
 * @param item - The tray item.
 * @param verdict - Its verdict, if any.
 * @returns The note, `✓ locked in`, or `✕ <reason>. try again?`.
 * @example
 * ```ts
 * trayNote(auth, { state: "rejected", reason: "missing session" }); // "✕ missing session. try again?"
 * ```
 */
export function trayNote(item: TrayPlugin, verdict: TrayVerdict | undefined): string {
  if (verdict === undefined) return item.note;
  if (verdict.state === "locked") return "✓ locked in";
  return `✕ ${verdict.reason}. try again?`;
}
