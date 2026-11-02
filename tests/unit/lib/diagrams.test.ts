import { describe, expect, it } from "vitest";
import { expandDiagrams } from "../../../src/lib/diagrams";

const svg = '<svg data-diagram-art="pipeline"></svg>';

describe("expandDiagrams", () => {
  // Bug: the docs show the empty placeholder frame instead of the drawing, or the caption is lost.
  it("puts the named drawing at the top of its figure and keeps the caption", () => {
    const html =
      '<p>Before</p><figure data-component="diagram" data-diagram="pipeline"><figcaption>Build</figcaption></figure>';

    expect(expandDiagrams(html, { pipeline: svg })).toBe(
      `<p>Before</p><figure data-component="diagram" data-diagram="pipeline">${svg}<figcaption>Build</figcaption></figure>`
    );
  });

  // Bug: a typo in a diagram name ships an empty frame without anyone noticing.
  it("throws on a diagram name it has no drawing for", () => {
    expect(() =>
      expandDiagrams('<figure data-component="diagram" data-diagram="pipelin"></figure>', {
        pipeline: svg
      })
    ).toThrow('[site] Diagram "pipelin" has no drawing.\n  Use one of: pipeline.');
  });

  // Bug: a page without diagrams is rewritten anyway.
  it("leaves html without diagrams unchanged", () => {
    expect(expandDiagrams("<p>Text</p>", { pipeline: svg })).toBe("<p>Text</p>");
  });
});
