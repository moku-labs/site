import { describe, expect, it } from "vitest";
import { createDocumentationState, resetDocumentationState } from "../../state";

describe("docs state", () => {
  // Bug: createState hands every app one shared object, so two apps (the build and a test) share
  // one page cache and one serves the other's docs tree.
  it("creates a fresh, empty state per call", () => {
    const first = createDocumentationState();
    first.pages = new Map();

    expect(createDocumentationState()).toEqual({ pages: undefined, pending: undefined });
  });

  // Bug: the reset drops only the pages, so the next call gets the old load back and a dev
  // rebuild serves the stale tree.
  it("reset drops both the pages and the load in flight", () => {
    const state = createDocumentationState();
    state.pages = new Map();
    state.pending = Promise.resolve(new Map());

    resetDocumentationState(state);

    expect(state).toEqual({ pages: undefined, pending: undefined });
  });
});
