import { describe, expect, it } from "vitest";
import {
  DEFAULT_PALETTE_DATA,
  isPaletteShortcut,
  isSuggestionLabelHidden,
  nextTabStop,
  packageIconUrl,
  parsePaletteData,
  statusMessage,
  stepSelection
} from "../../../src/lib/search-palette";

describe("parsePaletteData", () => {
  // Bug: a partial attribute wipes the defaults and the palette fetches an undefined shard.
  it("keeps the defaults for the fields the attribute leaves out", () => {
    expect(parsePaletteData('{"shard":"de","suggested":["/docs/"]}')).toEqual({
      baseUrl: "/",
      collection: "search",
      shard: "de",
      suggested: ["/docs/"]
    });
  });

  // Bug: a missing or broken attribute throws during mount.
  it("falls back to the defaults for a missing, broken or non-object attribute", () => {
    expect(parsePaletteData(undefined)).toEqual(DEFAULT_PALETTE_DATA);
    expect(parsePaletteData("{shard")).toEqual(DEFAULT_PALETTE_DATA);
    expect(parsePaletteData("null")).toEqual(DEFAULT_PALETTE_DATA);
  });
});

describe("packageIconUrl", () => {
  // Bug: the art path drifts from public/art and every package result shows a broken image.
  it("points at the package's 256 px art", () => {
    expect(packageIconUrl("worker")).toBe("/art/icon-worker-256.webp");
  });
});

describe("statusMessage", () => {
  const base = { failed: false, loaded: true, resultCount: 0, query: "zzz" };

  // Bug: a failed load keeps saying "Loading" forever.
  it("reports a failed load before anything else", () => {
    expect(statusMessage({ ...base, failed: true, loaded: false })).toMatch(/did not load/);
  });

  // Bug: "Nothing matches" shows while the index is still on its way.
  it("says the index is loading until it arrives", () => {
    expect(statusMessage({ ...base, loaded: false })).toBe("Loading the index…");
  });

  // Bug: the empty state loses the query, or shows on top of results.
  it("names the query when nothing matches and is silent when results show", () => {
    expect(statusMessage(base)).toMatch(/^Nothing matches "zzz"\./);
    expect(statusMessage({ ...base, resultCount: 2 })).toBe("");
  });
});

describe("isSuggestionLabelHidden", () => {
  // Bug: "Suggested" stays above real matches, or shows over an empty list while loading.
  it("shows the label only for a blank query once the index has loaded", () => {
    expect(isSuggestionLabelHidden("  ", true)).toBe(false);
    expect(isSuggestionLabelHidden("route", true)).toBe(true);
    expect(isSuggestionLabelHidden("", false)).toBe(true);
  });
});

describe("stepSelection", () => {
  // Bug: the arrows stop at the ends, or go negative and select nothing.
  it("wraps at both ends", () => {
    expect(stepSelection(2, "ArrowDown", 3)).toBe(0);
    expect(stepSelection(0, "ArrowUp", 3)).toBe(2);
    expect(stepSelection(1, "ArrowDown", 3)).toBe(2);
  });

  // Bug: an arrow on an empty list divides by zero and selects NaN; Enter moves the selection.
  it("leaves other keys and an empty list alone", () => {
    expect(stepSelection(0, "ArrowDown", 0)).toBeUndefined();
    expect(stepSelection(0, "Enter", 3)).toBeUndefined();
  });
});

describe("nextTabStop", () => {
  // Bug: Tab escapes the modal at the last stop, or Shift+Tab escapes at the first.
  it("wraps forwards and backwards", () => {
    expect(nextTabStop(2, false, 3)).toBe(0);
    expect(nextTabStop(0, true, 3)).toBe(2);
    expect(nextTabStop(-1, false, 3)).toBe(0);
  });
});

describe("isPaletteShortcut", () => {
  // Bug: Ctrl+K off a Mac, or K with Caps Lock, no longer opens the palette; a plain K does.
  it("accepts ⌘K and Ctrl+K in either case, and nothing without a modifier", () => {
    expect(isPaletteShortcut({ key: "k", metaKey: true, ctrlKey: false })).toBe(true);
    expect(isPaletteShortcut({ key: "K", metaKey: false, ctrlKey: true })).toBe(true);
    expect(isPaletteShortcut({ key: "k", metaKey: false, ctrlKey: false })).toBe(false);
    expect(isPaletteShortcut({ key: "j", metaKey: true, ctrlKey: false })).toBe(false);
  });
});
