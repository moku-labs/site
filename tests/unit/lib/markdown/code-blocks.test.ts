import { describe, expect, it } from "vitest";
import {
  parseFenceMeta,
  parseLineList,
  splitCodeLines
} from "../../../../src/lib/markdown/code-blocks";
import { render } from "./render";

const fence = (meta: string, code: string, lang = "ts") =>
  `\`\`\`${lang} ${meta}\n${code}\n\`\`\`\n`;

describe("parseFenceMeta", () => {
  // Catches: quoted values cut at the space or keeping their quotes, flags read as attributes.
  it("reads quoted, single-quoted and bare values and bare flags", () => {
    const meta = parseFenceMeta(`file="src/my app.ts" group='g 1' hl=3,5-7 check`);

    expect(meta.attributes).toEqual({ file: "src/my app.ts", group: "g 1", hl: "3,5-7" });
    expect([...meta.flags]).toEqual(["check"]);
  });
});

describe("parseLineList", () => {
  // Catches: a range end excluded or the range not expanded.
  it("expands numbers and ranges", () => {
    expect([...parseLineList("3,5-7", 7)]).toEqual([3, 5, 6, 7]);
  });

  // Catches: a typo in hl silently highlighting nothing.
  it.each(["a", "7-5", "0", "3,,4"])("refuses %s", list => {
    expect(() => parseLineList(list, 10)).toThrow(/is not a line list/);
  });

  // Catches: hl naming a line the block does not have, after notes shifted the count.
  it("refuses a line past the end", () => {
    expect(() => parseLineList("4-6", 5)).toThrow(/names line 6, but the block shows 5 lines/);
  });
});

describe("splitCodeLines", () => {
  // Catches: a note comment left in the code, an own-line note kept as an empty line or marking
  // the wrong line, a note at the end of the block lost.
  it("takes notes out and marks their lines", () => {
    const code =
      "a(); // [!note] First\n// [!note] Second\nb();\nc(); # [!note]  Third \n# [!note] Last";

    expect(splitCodeLines(code, false)).toEqual({
      lines: [
        { text: "a();", notes: [1] },
        { text: "b();", notes: [2] },
        { text: "c();", notes: [3, 4] }
      ],
      notes: ["First", "Second", "Third", "Last"]
    });
  });

  // Catches: diff signs left in the code or rows given the wrong kind; a line without a sign cut.
  it("turns diff signs into rows", () => {
    expect(splitCodeLines("+a\n-b\n c\nd", true).lines).toEqual([
      { text: "a", change: "add", notes: [] },
      { text: "b", change: "del", notes: [] },
      { text: "c", notes: [] },
      { text: "d", notes: [] }
    ]);
  });

  // Catches: a `+` at the start of a normal line read as a diff sign.
  it("keeps the code of a block that is no diff", () => {
    expect(splitCodeLines("+1", false).lines).toEqual([{ text: "+1", notes: [] }]);
  });
});

describe("codeBlocks through the content pipeline", () => {
  // Catches: the fence meta lost on the way (rehype-raw drops data.meta), notes leaking into the
  // code or into what Copy takes, highlights on the wrong line.
  it("renders file, highlights, note markers and the note list", async () => {
    const html = await render(
      fence(
        'file="src/app.ts" hl="1,3"',
        "const a = 1; // [!note] The first\nconst b = 2;\nconst c = 3;"
      )
    );

    expect(html).toContain(
      '<figure data-component="code" data-copy="const a = 1;\nconst b = 2;\nconst c = 3;" data-file="src/app.ts">'
    );
    expect(html).toContain('<figcaption data-part="file">src/app.ts</figcaption>');
    expect(html).toContain(
      '<span data-line="1" data-highlight data-note="1"></span><span data-line="2"></span><span data-line="3" data-highlight></span>'
    );
    expect(html).toContain('<ol data-component="code-notes"><li data-note="1">The first</li></ol>');
    expect(html).not.toContain("[!note]");
    expect(html).not.toContain("data-meta");
    expect(html).toContain('<pre class="shiki');
  });

  // Catches: a plain fence left without the figure, or given an empty file label.
  it("wraps a fence without meta in a bare code figure", async () => {
    const html = await render("```\nplain\n```\n");

    expect(html).toContain(
      '<figure data-component="code" data-copy="plain"><div data-part="body">'
    );
    expect(html).not.toContain("figcaption");
    expect(html).not.toContain("code-notes");
  });

  // Catches: diff signs shown in the code, deleted lines copied, the code highlighted as `diff`.
  it("renders a diff block as rows; Copy takes the resulting code", async () => {
    const html = await render(
      fence("lang=ts", "-const a = 1;\n+const a = 2;\n export { a };", "diff")
    );

    expect(html).toContain('data-copy="const a = 2;\nexport { a };"');
    expect(html).toContain(
      '<span data-line="1" data-diff="del"></span><span data-line="2" data-diff="add"></span><span data-line="3"></span>'
    );
    expect(html).toContain("var(--code-keyword)");
    expect(html).not.toMatch(/>[+-]const/);
  });

  // Catches: a diff block without lang= failing or keeping the diff grammar.
  it("shows a diff block without lang as plain text", async () => {
    const html = await render(fence("", "+added", "diff"));

    expect(html).toContain('data-copy="added"');
    expect(html).toContain('data-diff="add"');
  });

  // Catches: the diff flag ignored on a fence with a real language.
  it("reads the diff flag on any language", async () => {
    const html = await render(fence("diff", "+const a = 1;"));

    expect(html).toContain('data-diff="add"');
    expect(html).toContain('data-copy="const a = 1;"');
  });

  // Catches: consecutive grouped fences not merged into tabs, a new group swallowed by the old one,
  // no tab or more than one tab selected.
  it("turns consecutive fences of one group into tabs", async () => {
    const html = await render(
      [
        fence('file="a.ts" group="one"', "a();"),
        fence('file="b.ts" group="one"', "b();"),
        fence('file="c.ts" group="two"', "c();"),
        "Between.\n",
        fence('file="d.ts" group="two"', "d();")
      ].join("\n")
    );

    const groups = [...html.matchAll(/<div data-component="code-group" data-group="([^"]+)">/g)];
    expect(groups.map(match => match[1])).toEqual(["one", "two", "two"]);
    expect(html).toContain(
      '<div data-part="tabs" role="tablist"><button type="button" role="tab" data-file="a.ts" aria-selected="true">a.ts</button><button type="button" role="tab" data-file="b.ts" aria-selected="false">b.ts</button></div>'
    );
    expect(html).toContain('</figure></div><div data-component="code-group" data-group="two">');
  });

  // Catches: a grouped fence rendered as a tab with no label.
  it("refuses a grouped fence without a file", async () => {
    await expect(render(fence('group="one"', "a();"))).rejects.toThrow(
      /Code block in group "one" has no file/
    );
  });

  // Catches: an hl past the end of the block rendered without a word.
  it("fails the render on an hl past the end", async () => {
    await expect(render(fence('hl="2"', "a();"))).rejects.toThrow(/names line 2/);
  });
});
