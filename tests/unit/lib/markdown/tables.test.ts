import { describe, expect, it } from "vitest";
import { render } from "./render";

describe("tables through the content pipeline", () => {
  // Catches: a table left bare, so a narrow table does not fill the column and a wide one
  // scrolls the whole page; also the plugin not wired in src/app.ts.
  it("wraps a Markdown table in its scroll box", async () => {
    const html = await render("| Option | Default |\n| --- | --- |\n| `outDir` | `dist` |\n");

    expect(html.trim()).toMatch(/^<div data-part="table"><table>[\s\S]*<\/table><\/div>$/);
  });

  // Catches: only top-level tables wrapped, a table inside a list or callout left bare.
  it("wraps a table nested in a list item", async () => {
    const html = await render("- Item\n\n  | A |\n  | - |\n  | 1 |\n");

    expect(html).toMatch(/<li>\s*<p>Item<\/p>\s*<div data-part="table"><table>/);
  });
});
