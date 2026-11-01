import { describe, expect, it } from "vitest";
import { parseFrontmatter } from "../../frontmatter";

const page = (fields: string, body = "# Body\n"): string => `---\n${fields}\n---\n\n${body}`;

describe("parseFrontmatter", () => {
  // Bug: `order: 2` stays the string "2" and "10" sorts before "2"; `full: false` is truthy.
  it("types order as a number and full as a boolean, and unquotes strings", () => {
    const { data } = parseFrontmatter(
      page(
        "title: \"Head & SEO\"\ndescription: 'Meta tags.'\norder: 10\nfull: false\nsection: Guides"
      ),
      "a.md"
    );
    expect(data).toEqual({
      title: "Head & SEO",
      description: "Meta tags.",
      order: 10,
      full: false,
      section: "Guides"
    });
  });

  // Bug: the frontmatter block leaks into the rendered page; CRLF files lose their fields.
  it("returns the body after the closing fence, also for CRLF files", () => {
    const parsed = parseFrontmatter(
      "---\r\ntitle: T\r\ndescription: D\r\n---\r\n\r\n## Hi\r\n",
      "a.md"
    );
    expect(parsed.data.title).toBe("T");
    expect(parsed.body).toBe("## Hi\n");
  });

  // Bug: a page without a title renders an empty <h1> and an empty nav entry.
  it("throws naming the file and field when title is missing", () => {
    expect(() => parseFrontmatter(page("description: D"), "content/docs/web/a.md")).toThrow(
      '[docs] content/docs/web/a.md: frontmatter field "title" is missing.'
    );
  });

  // Bug: an empty description passes and the meta description is blank.
  it("treats an empty description as missing", () => {
    expect(() => parseFrontmatter(page('title: T\ndescription: ""'), "b.md")).toThrow(
      'b.md: frontmatter field "description" is missing'
    );
  });

  // Bug: a file without any frontmatter is published with no title.
  it("throws when the file has no frontmatter block", () => {
    expect(() => parseFrontmatter("# Just markdown\n", "c.md")).toThrow('"title" is missing');
  });

  // Bug: `order: second` becomes NaN and the sidebar order is random.
  it("throws when order is not a number", () => {
    expect(() => parseFrontmatter(page("title: T\ndescription: D\norder: second"), "d.md")).toThrow(
      'd.md: frontmatter field "order" must be a number'
    );
  });

  // Bug: `full: yes` is read as false and the full-reference badge disappears.
  it("throws when full is not true or false", () => {
    expect(() => parseFrontmatter(page("title: T\ndescription: D\nfull: yes"), "e.md")).toThrow(
      'e.md: frontmatter field "full" must be true or false'
    );
  });
});
