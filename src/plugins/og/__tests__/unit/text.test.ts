import { describe, expect, it } from "vitest";
import { cardLine, columnWidth, titleSize } from "../../text";

describe("cardLine", () => {
  // Bug: the rule starts one character early and shortens a line that fits.
  it("keeps a text of 56 characters whole, even with a sentence inside", () => {
    const text = "First part ends here. The rest fills up to fifty six ch.";

    expect(text).toHaveLength(56);
    expect(cardLine(text)).toBe(text);
  });

  // Bug: the rule starts one character late, and a 57 character line overflows two lines.
  it("shortens a text of 57 characters", () => {
    const text = "aaaaaaaaa bbbbbbbbb ccccccccc ddddddddd eeeeeeeee fffffff";

    expect(text).toHaveLength(57);
    expect(cardLine(text)).toBe("aaaaaaaaa bbbbbbbbb ccccccccc ddddddddd eeeeeeeee…");
  });

  // Bug: a long text is cut at a word although its first sentence says the whole thing.
  it("takes the first sentence when it fits and keeps its period", () => {
    const text = "Micro-kernel plugin framework. Under 8 KB, zero dependencies.";

    expect(cardLine(text)).toBe("Micro-kernel plugin framework.");
  });

  // Bug: the limit moves up, and a clear first sentence of 20 characters is cut for no reason.
  it("takes a first sentence of 20 characters", () => {
    const sentence = "Twenty long letters.";

    expect(sentence).toHaveLength(20);
    expect(cardLine(`${sentence} The rest of this text is long enough to pass the limit.`)).toBe(
      sentence
    );
  });

  // Bug: the limit moves down, and a card says only `Logic.` or `Optional provider.`.
  it("cuts at a word when the first sentence has 19 characters", () => {
    const sentence = "Eighteen character.";
    const text = `${sentence} The rest of this text is long enough to pass the limit.`;

    expect(sentence).toHaveLength(19);
    expect(cardLine(text)).toBe("Eighteen character. The rest of this text is long…");
  });

  // Bug: a one-word first sentence stands alone on the card.
  it("never makes a whole line of a one-word first sentence", () => {
    const text = "Logic. Moves the player state forward once per tick of the game clock.";

    expect(cardLine(text)).toBe("Logic. Moves the player state forward once per tick of…");
  });

  // Bug: the minimum counts the colon that is dropped, and the card draws a line of 19 characters.
  it("measures the first sentence without the colon it drops", () => {
    const text = "Nineteen characters: the rest of this text is long enough to pass the limit.";

    expect(cardLine(text)).toBe("Nineteen characters: the rest of this text is long…");
  });

  // Bug: the word cut keeps `→`, which the latin fonts do not have: the card shows an empty square.
  it("ends a cut text before a character the fonts do not have", () => {
    const text = "Optional provider. Page path → JSON file: the build writes each page's result.";

    expect(cardLine(text)).toBe("Optional provider. Page path…");
  });

  // Bug: a character far behind the limit shortens the line for nothing.
  it("cuts at the limit when the character the fonts do not have comes later", () => {
    const text = "One two three four five six seven eight nine ten eleven twelve → thirteen";

    expect(cardLine(text)).toBe("One two three four five six seven eight nine ten eleven…");
  });

  // Bug: the card ends on a dangling colon, or `→` of the rest reaches the font: an empty square.
  it("drops the colon that ends the first sentence", () => {
    const text = "A conductor in Claude Code: idea → plan → build → verify → release, on rails";

    expect(cardLine(text)).toBe("A conductor in Claude Code");
  });

  // Bug: the dots of a call chain read as sentence ends, and the line stops at `route().`.
  it("ends a sentence only at a mark followed by a space", () => {
    const text = "route().load().render().head(): one typed builder is the whole contract";

    expect(cardLine(text)).toBe("route().load().render().head()");
  });

  // Bug: a first sentence longer than the limit is taken as it is and overflows the card.
  it("cuts at a word when the first sentence is too long", () => {
    const text = "From an empty folder to a deployed static blog with client navigation. Done.";

    expect(cardLine(text)).toBe("From an empty folder to a deployed static blog with…");
  });

  // Bug: the word that crosses the limit is cut in half.
  it("never cuts inside a word and stays inside the limit with the ellipsis", () => {
    const text = "One two three four five six seven eight nine ten elevenelevenelevenelevenXX";
    const line = cardLine(text);

    expect(line).toBe("One two three four five six seven eight nine ten…");
    expect(line.length).toBeLessThanOrEqual(56);
  });

  // Bug: the ellipsis lands behind a comma: `plugin,…`.
  it("drops the punctuation in front of the ellipsis", () => {
    const text = "Cloudflare Workers backend with D1, KV, R2, Queues, each, one plugin here";

    expect(cardLine(text)).toBe("Cloudflare Workers backend with D1, KV, R2, Queues…");
  });

  // Bug: a text with no space at all is lost: `lastIndexOf` is -1 and the cut goes wrong.
  it("cuts one long word at the limit", () => {
    const line = cardLine("x".repeat(80));

    expect(line).toBe(`${"x".repeat(55)}…`);
  });
});

describe("titleSize", () => {
  // Bug: the tier boundary moves, and a 12 character title drops to the small size or wraps.
  it("uses the big size up to 12 characters and the small one above", () => {
    expect(titleSize("a".repeat(12))).toBe(96);
    expect(titleSize("a".repeat(13))).toBe(72);
  });
});

describe("columnWidth", () => {
  // Bug: a title over 44 characters stays in the narrow column and clamps away its end.
  it("widens the text column only for a title over 44 characters", () => {
    expect(columnWidth("a".repeat(44))).toBe(600);
    expect(columnWidth("a".repeat(45))).toBe(930);
  });
});
