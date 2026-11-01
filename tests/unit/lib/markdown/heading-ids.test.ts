import { describe, expect, it } from "vitest";
import { headingSlug } from "../../../../src/lib/markdown/heading-ids";
import { extractHeadings, slugify } from "../../../../src/plugins/docs/markdown";
import { render } from "./render";

/** The ids of the h2/h3 elements in rendered HTML, in document order. */
function renderedIds(html: string): string[] {
  return [...html.matchAll(/<h[23] id="([^"]*)"/g)].map(match => match[1] ?? "");
}

describe("headingSlug", () => {
  // Catches: a slug that keeps punctuation, double dashes or outer spaces, so `#head-seo` misses.
  it("keeps only a-z, 0-9 and single dashes", () => {
    expect(headingSlug("  Head & SEO ")).toBe("head-seo");
    expect(headingSlug("The route() helper, v2")).toBe("the-route-helper-v2");
  });

  // Catches: the rendered ids and the docs TOC drifting apart (the two copies of the algorithm).
  it("gives the same slug as the docs plugin", () => {
    const texts = ["Head & SEO", "  Why errors, not warnings?", "i18n -- locales", "Café 2.0"];
    expect(texts.map(text => headingSlug(text))).toEqual(texts.map(text => slugify(text)));
  });
});

describe("headingIds through the content pipeline", () => {
  // Catches: repeats not deduplicated, headings inside a callout skipped or counted out of
  // document order, so the TOC anchors point at the wrong section.
  it("puts the docs TOC ids on h2/h3 in document order, repeats get -2 and -3", async () => {
    const markdown =
      "## Setup\n\n:::callout\n### Setup\n:::\n\n## The `route()` helper\n\n### Setup\n\n#### Setup\n";

    const html = await render(markdown);

    expect(renderedIds(html)).toEqual(["setup", "setup-2", "the-route-helper", "setup-3"]);
    expect(renderedIds(html)).toEqual(extractHeadings(markdown).map(heading => heading.id));
    expect(html).toContain("<h4>Setup</h4>");
  });
});
