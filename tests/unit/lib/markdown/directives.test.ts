import { describe, expect, it } from "vitest";
import { render } from "./render";

describe("directives through the content pipeline", () => {
  // Catches: a callout falling back to a bare <div>, the tone lost, the title left as a paragraph.
  it("renders a callout with its tone and title", async () => {
    const html = await render(':::callout[Heads up]{tone="warn"}\nMind the order.\n:::\n');

    expect(html).toContain(
      '<aside data-component="callout" data-tone="warn"><p data-part="title">Heads up</p><p>Mind the order.</p></aside>'
    );
  });

  // Catches: a callout without tone left without data-tone, so no style applies.
  it("makes a callout without tone neutral", async () => {
    expect(await render(":::callout\nNote.\n:::\n")).toContain(
      '<aside data-component="callout" data-tone="neutral">'
    );
  });

  // Catches: steps, flow or gotchas silently rendered as plain lists.
  it.each(["steps", "flow", "gotchas"])("renders :::%s as its component", async name => {
    const html = await render(`:::${name}\n1. One\n2. Two\n:::\n`);

    expect(html).toContain(`<div data-component="${name}"><ol>`);
  });

  // Catches: the diagram name or its caption lost.
  it("renders a diagram by name with its caption", async () => {
    expect(await render('::diagram[Build to SPA]{name="pipeline"}\n')).toContain(
      '<figure data-component="diagram" data-diagram="pipeline"><figcaption>Build to SPA</figcaption></figure>'
    );
  });

  // Catches: a figcaption added to a diagram that has no caption.
  it("renders a diagram without caption as an empty figure", async () => {
    expect(await render('::diagram{name="pipeline"}\n')).toContain(
      '<figure data-component="diagram" data-diagram="pipeline"></figure>'
    );
  });

  // Catches: a terminal shown as a code block, `$` commands not marked, Copy taking output lines.
  it("renders a terminal fence: commands, ok, error and output lines; Copy takes commands", async () => {
    const html = await render(
      '```sh terminal title="build"\n$ bun install\n$ bun run build\n✓ 42 pages\n✕ 1 error\nwaiting\n```\n'
    );

    expect(html).toContain(
      '<figure data-component="terminal" data-copy="bun install\nbun run build"><figcaption data-part="title">build</figcaption><pre data-part="screen" tabindex="0"><span data-kind="command">bun install</span>\n<span data-kind="command">bun run build</span>\n<span data-kind="ok">✓ 42 pages</span>\n<span data-kind="error">✕ 1 error</span>\n<span data-kind="output">waiting</span></pre></figure>'
    );
  });

  // Catches: an empty title bar on a terminal without title.
  it("renders a terminal without title without a caption", async () => {
    expect(await render("```sh terminal\n$ ls\n```\n")).toContain(
      '<figure data-component="terminal" data-copy="ls"><pre data-part="screen" tabindex="0">'
    );
  });

  // Catches: a prompt shown as a code block.
  it("renders a prompt fence as a prompt bubble", async () => {
    expect(await render("```text prompt\nAdd a docs page.\n```\n")).toContain(
      '<figure data-component="prompt" data-copy="Add a docs page."><p data-part="text">Add a docs page.</p></figure>'
    );
  });

  // Catches: `router:navigate` in prose eaten by remark-directive into an empty <div>.
  it("keeps inline :name text as written", async () => {
    const html = await render("Emit router:navigate, a:b[c]{d=e} and x:y{flag}.\n");

    expect(html).toContain('<p>Emit router:navigate, a:b[c]{d="e"} and x:y{flag}.</p>');
  });

  // Catches: the framework's own pull-quote directive refused as unknown.
  it("leaves framework directives to the framework", async () => {
    expect(await render(":::pullquote\nQuote.\n:::\n")).toContain('<aside class="pull-quote">');
  });

  // Catches: a misspelled directive, a wrong tone, a diagram without name or the spec-style
  // `:::callout warn` rendering silently as plain text.
  it.each([
    [":::calout\nText.\n:::\n", /Directive "calout" is unknown/],
    [':::callout{tone="danger"}\nText.\n:::\n', /Callout tone "danger" is unknown/],
    ["::diagram\n", /Diagram directive has no name/],
    [":::callout warn\nText.\n:::\n", /":::callout warn" is not a directive/]
  ])("fails the render on %j", async (markdown, message) => {
    await expect(render(markdown)).rejects.toThrow(message);
  });
});
