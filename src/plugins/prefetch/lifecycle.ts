/**
 * @file The DOM side of the `prefetch` plugin: document listeners and the viewport observer.
 */
import { type ConnectionLike, isEagerAllowed, type LinkWarmer } from "../../lib/link-prefetch";
import type { PrefetchConfig, PrefetchState } from "./types";

/**
 * The link an event happened on.
 *
 * @param target - The event target.
 * @returns The closest `<a>`, or `undefined`.
 */
function linkOf(target: EventTarget | null): HTMLAnchorElement | undefined {
  return target instanceof Element ? (target.closest("a") ?? undefined) : undefined;
}

/**
 * The reader's connection, where the browser reports it.
 *
 * @returns `navigator.connection`, or `undefined`.
 */
function readConnection(): ConnectionLike | undefined {
  const connection: unknown = Reflect.get(navigator, "connection");
  return typeof connection === "object" && connection !== null ? connection : undefined;
}

/**
 * Run a task when the main thread is idle, or after `timeout` at the latest.
 *
 * @param task - The task.
 * @param timeout - Longest wait in milliseconds.
 */
function whenIdle(task: () => void, timeout: number): void {
  if (typeof requestIdleCallback === "function") requestIdleCallback(task, { timeout });
  else setTimeout(task, timeout);
}

/**
 * Warm on intent: a mouse resting on a link, a finger touching it, or keyboard focus.
 *
 * @param state - Plugin state with the warmer.
 * @param config - Plugin config.
 */
export function listenForIntent(state: PrefetchState, config: PrefetchConfig): void {
  const { warmer } = state;
  if (warmer === undefined) return;

  // A fresh controller per start, so a restart after onStop listens again.
  state.listeners = new AbortController();
  const options = { signal: state.listeners.signal, passive: true };
  const warmNow = (event: Event): void => {
    const link = linkOf(event.target);
    if (link !== undefined) warmer.warm(link);
  };

  // A mouse warms after a short rest, so sweeping across the page warms nothing.
  document.addEventListener(
    "pointerover",
    event => {
      if (event.pointerType !== "mouse") return;
      clearTimeout(state.hover);
      state.hover = setTimeout(() => warmNow(event), config.hoverDelay);
    },
    options
  );
  document.addEventListener("pointerout", () => clearTimeout(state.hover), options);
  document.addEventListener("touchstart", warmNow, options);
  document.addEventListener("focusin", warmNow, options);
}

/**
 * Warm the links that entered the view; stop watching once the budget is spent.
 *
 * @param entries - The observer entries.
 * @param warmer - The warmer.
 * @param observer - The observer to stop.
 */
function warmInView(
  entries: IntersectionObserverEntry[],
  warmer: LinkWarmer,
  observer: IntersectionObserver
): void {
  for (const entry of entries) {
    if (!entry.isIntersecting) continue;
    observer.unobserve(entry.target);
    warmer.warmVisible(entry.target);
    if (warmer.isSpent()) {
      observer.disconnect();
      return;
    }
  }
}

/**
 * Watch the links of the current page and warm those that come into view, while the budget
 * lasts. Not on save-data or 2g.
 *
 * @param state - Plugin state with the warmer.
 * @param config - Plugin config.
 */
export function watchViewport(state: PrefetchState, config: PrefetchConfig): void {
  // Drop the observer of the previous page.
  state.observer?.disconnect();
  state.observer = undefined;

  // Watch nothing without a warmer, an observer, or a connection that allows eager warming.
  const { warmer } = state;
  const hasBudget = config.viewportBudget > 0;
  const canWatch = typeof IntersectionObserver === "function" && isEagerAllowed(readConnection());
  if (warmer === undefined || !hasBudget || !canWatch) return;

  // Observe every link once the main thread is idle: unless stopped meanwhile, and replacing an
  // observer a faster navigation already set.
  const signal = state.listeners?.signal;
  whenIdle(() => {
    if (signal?.aborted === true) return;
    state.observer?.disconnect();
    const observer = new IntersectionObserver(entries => warmInView(entries, warmer, observer));
    for (const link of document.querySelectorAll("a[href]")) observer.observe(link);
    state.observer = observer;
  }, config.idleTimeout);
}

/**
 * Release every listener, the observer and a pending hover warm-up.
 *
 * @param state - Plugin state.
 */
export function stopWatching(state: PrefetchState): void {
  state.listeners?.abort();
  state.observer?.disconnect();
  state.observer = undefined;
  clearTimeout(state.hover);
}
