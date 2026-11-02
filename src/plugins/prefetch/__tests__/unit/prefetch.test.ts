import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prefetchPlugin } from "../../index";
import type { PrefetchConfig, PrefetchState } from "../../types";

const HERE = "https://moku-labs.com/docs/";

/** A fake `<a>`, stubbed in as the global `Element`: enough for `closest` and the checks. */
class FakeLink {
  readonly #href: string;

  /**
   * @param href - The `href` attribute.
   */
  constructor(href: string) {
    this.#href = href;
  }

  /**
   * The link itself: every fake event happens on the link.
   *
   * @returns This link.
   */
  closest(): FakeLink {
    return this;
  }

  /**
   * Read an attribute: only `href` is set.
   *
   * @param name - Attribute name.
   * @returns The value, or `undefined`.
   */
  getAttribute(name: string): string | undefined {
    return name === "href" ? this.#href : undefined;
  }

  /**
   * Whether an attribute is set: none of the flags are.
   *
   * @returns `false`.
   */
  hasAttribute(): boolean {
    return false;
  }
}

/** What a fake observer saw. */
type ObserverRecord = {
  callback: (entries: object[]) => void;
  observed: FakeLink[];
  disconnected: boolean;
};

/** The document listeners the plugin added, by event name. */
let listeners: Map<string, Set<(event: object) => void>>;
/** The links `querySelectorAll` returns. */
let pageLinks: FakeLink[];
/** Every observer the plugin created, oldest first. */
let observers: ObserverRecord[];

/**
 * The latest observer the plugin created.
 *
 * @returns Its record; the test fails when there is none.
 */
function latestObserver(): ObserverRecord {
  const record = observers.at(-1);
  if (record === undefined) throw new Error("no IntersectionObserver was created");
  return record;
}

beforeEach(() => {
  vi.useFakeTimers();
  listeners = new Map();
  pageLinks = [];
  observers = [];
  vi.stubGlobal("Element", FakeLink);
  vi.stubGlobal("location", { href: HERE });
  vi.stubGlobal("navigator", {});
  vi.stubGlobal("requestIdleCallback", (task: () => void) => setTimeout(task, 0));
  vi.stubGlobal("document", {
    addEventListener: (
      name: string,
      handler: (event: object) => void,
      options: { signal: AbortSignal }
    ) => {
      const set = listeners.get(name) ?? new Set();
      set.add(handler);
      listeners.set(name, set);
      options.signal.addEventListener("abort", () => set.delete(handler));
    },
    querySelectorAll: () => pageLinks
  });
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      readonly #record: ObserverRecord;
      constructor(callback: (entries: object[]) => void) {
        this.#record = { callback, observed: [], disconnected: false };
        observers.push(this.#record);
      }
      observe(link: FakeLink): void {
        this.#record.observed.push(link);
      }
      unobserve(): void {}
      disconnect(): void {
        this.#record.disconnected = true;
      }
    }
  );
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

/**
 * Fire a document event at the plugin's listeners.
 *
 * @param name - Event name.
 * @param event - The event object.
 */
function fire(name: string, event: object): void {
  for (const handler of listeners.get(name) ?? []) handler(event);
}

/**
 * Start the plugin with a spy for `data.at`.
 *
 * @param config - Config overrides.
 * @returns The spy, the context and the spec.
 */
function start(config: Partial<PrefetchConfig> = {}) {
  const at = vi.fn();
  const { spec } = prefetchPlugin;
  const merged: PrefetchConfig = {
    hoverDelay: 65,
    viewportBudget: 6,
    idleTimeout: 1200,
    ...config
  };
  if (spec.createState === undefined) throw new Error("prefetch has no createState");
  const state: PrefetchState = spec.createState({ global: {}, config: merged });
  const ctx = { config: merged, state, require: () => ({ at }) };
  spec.onStart?.(ctx as never);
  return { at, ctx, spec };
}

describe("prefetch plugin", () => {
  // Bug: a touch on a link does not warm its page, so a phone tap waits for the network.
  it("warms a link's page on touch and on focus", () => {
    const { at } = start();

    fire("touchstart", { target: fakeLink("/docs/web/") });
    fire("focusin", { target: fakeLink("/about/") });
    fire("touchstart", { target: fakeLink("/docs/web/") });

    expect(at.mock.calls).toEqual([["/docs/web/"], ["/about/"]]);
  });

  // Bug: sweeping the mouse across the page warms every link it crosses; or a rest warms nothing.
  it("warms on a mouse rest of hoverDelay, not on a pass or a pen", () => {
    const { at } = start();

    fire("pointerover", { pointerType: "mouse", target: fakeLink("/a/") });
    vi.advanceTimersByTime(30);
    fire("pointerout", {});
    fire("pointerover", { pointerType: "pen", target: fakeLink("/b/") });
    fire("pointerover", { pointerType: "mouse", target: fakeLink("/c/") });
    vi.advanceTimersByTime(65);

    expect(at.mock.calls).toEqual([["/c/"]]);
  });

  // Bug: an event on a text node or the document itself throws instead of being ignored.
  it("ignores events that are not on an element", () => {
    const { at } = start();

    fire("touchstart", { target: undefined });
    fire("focusin", { target: {} });

    expect(at).not.toHaveBeenCalled();
  });

  // Bug: links in view are never warmed, or all of them are, past the budget.
  it("warms links that come into view, up to the budget, once idle", () => {
    pageLinks = [fakeLink("/a/"), fakeLink("/b/"), fakeLink("/c/")];
    const { at } = start({ viewportBudget: 2 });
    vi.advanceTimersByTime(0);
    const observer = latestObserver();

    observer.callback(pageLinks.map(target => ({ target, isIntersecting: true })));

    expect(observer.observed).toEqual(pageLinks);
    expect(at.mock.calls).toEqual([["/a/"], ["/b/"]]);
    expect(observer.disconnected).toBe(true);
  });

  // Bug: a link scrolled past without entering the view is warmed.
  it("skips observer entries that are not in view", () => {
    pageLinks = [fakeLink("/a/")];
    const { at } = start();
    vi.advanceTimersByTime(0);

    latestObserver().callback([{ target: pageLinks[0], isIntersecting: false }]);

    expect(at).not.toHaveBeenCalled();
  });

  // Bug: a reader on save-data or 2g pays for pages they never asked for.
  it("does not watch the view on save-data or a 2g connection", () => {
    pageLinks = [fakeLink("/a/")];
    for (const connection of [{ saveData: true }, { effectiveType: "2g" }]) {
      vi.stubGlobal("navigator", { connection });
      start();
      vi.advanceTimersByTime(5000);
    }

    expect(observers).toEqual([]);
  });

  // Bug: a browser that reports no usable connection object stops eager warming.
  it("watches the view when navigator.connection is not an object", () => {
    vi.stubGlobal("navigator", { connection: "4g" });
    start();
    vi.advanceTimersByTime(0);

    expect(observers).toHaveLength(1);
  });

  // Bug: after an SPA navigation the new page's links are never watched, or the budget stays spent.
  it("watches the new page after spa:navigated, with a full budget", () => {
    pageLinks = [fakeLink("/a/")];
    const { at, ctx, spec } = start({ viewportBudget: 1 });
    vi.advanceTimersByTime(0);
    const first = latestObserver();
    first.callback([{ target: pageLinks[0], isIntersecting: true }]);

    pageLinks = [fakeLink("/b/")];
    const hooks = spec.hooks?.(ctx as never) as Record<string, () => void>;
    hooks["spa:navigated"]?.();
    vi.advanceTimersByTime(0);
    latestObserver().callback([{ target: pageLinks[0], isIntersecting: true }]);

    expect(first.disconnected).toBe(true);
    expect(latestObserver()).not.toBe(first);
    expect(at.mock.calls).toEqual([["/a/"], ["/b/"]]);
  });

  // Bug: listeners and the observer outlive the app, and a stopped app still fetches.
  it("removes every listener and the observer on stop", () => {
    pageLinks = [fakeLink("/a/")];
    const { at, ctx, spec } = start();
    vi.advanceTimersByTime(0);
    fire("pointerover", { pointerType: "mouse", target: fakeLink("/c/") });

    spec.onStop?.(ctx as never);
    vi.advanceTimersByTime(100);
    fire("touchstart", { target: fakeLink("/d/") });

    expect(at).not.toHaveBeenCalled();
    expect(latestObserver().disconnected).toBe(true);
    expect([...listeners.values()].every(set => set.size === 0)).toBe(true);
  });

  // Bug: a start after a stop attaches listeners to an aborted signal, so nothing is warmed.
  it("listens again when started after a stop", () => {
    const { at, ctx, spec } = start();
    spec.onStop?.(ctx as never);

    spec.onStart?.(ctx as never);
    fire("touchstart", { target: fakeLink("/again/") });

    expect(at.mock.calls).toEqual([["/again/"]]);
  });

  // Bug: a stop before the idle moment still creates an observer that nothing disconnects.
  it("creates no observer when stopped before the idle moment", () => {
    pageLinks = [fakeLink("/a/")];
    const { ctx, spec } = start();

    spec.onStop?.(ctx as never);
    vi.advanceTimersByTime(5000);

    expect(observers).toEqual([]);
  });

  // Bug: two navigations before one idle moment leave the first page's observer running.
  it("keeps one observer when two navigations share an idle moment", () => {
    pageLinks = [fakeLink("/a/")];
    vi.stubGlobal("requestIdleCallback", (task: () => void) => setTimeout(task, 10));
    const { ctx, spec } = start();
    const hooks = spec.hooks?.(ctx as never) as Record<string, () => void>;

    hooks["spa:navigated"]?.();
    vi.advanceTimersByTime(10);

    expect(observers).toHaveLength(2);
    expect(observers[0]?.disconnected).toBe(true);
    expect(observers[1]?.disconnected).toBe(false);
  });

  // Bug: without requestIdleCallback (Safari) the view is never watched.
  it("falls back to a timer when the browser has no idle callback", () => {
    vi.stubGlobal("requestIdleCallback", undefined);
    pageLinks = [fakeLink("/a/")];
    start({ idleTimeout: 500 });
    vi.advanceTimersByTime(499);

    expect(observers).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(latestObserver().observed).toEqual(pageLinks);
  });
});

/**
 * A fake link to a path.
 *
 * @param href - The `href` attribute.
 * @returns The link.
 */
function fakeLink(href: string): FakeLink {
  return new FakeLink(href);
}
