import { describe, expect, it } from "vitest";
import { ogCardFile, ogImagePath } from "../../../src/lib/og-path";

describe("ogImagePath", () => {
  // Bug: the site root maps to `/og/.png`, so the home page shares a card that does not exist.
  it("maps the site root to the home card", () => {
    expect(ogImagePath("/")).toBe("/og/home.png");
  });

  // Bug: the trailing slash survives, and a page points at `/og/docs/web/.png`.
  it("maps a page path to a png named after its last segment", () => {
    expect(ogImagePath("/docs/")).toBe("/og/docs.png");
    expect(ogImagePath("/docs/web/")).toBe("/og/docs/web.png");
    expect(ogImagePath("/docs/web/guides/routing/")).toBe("/og/docs/web/guides/routing.png");
  });
});

describe("ogCardFile", () => {
  // Bug: the plugin writes a file the head does not point at: a leading slash escapes `outDir`.
  it("is the image path relative to the card folder", () => {
    expect(ogCardFile("/")).toBe("home.png");
  });
});
