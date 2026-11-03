import { describe, expect, it } from "vitest";
import { tokenize } from "../../../src/lib/search-tokens";

describe("tokenize", () => {
  // Bug: `createApp` is only found as one word, so `create` or `app` miss the page that uses it.
  it("keeps a camelCase word whole and adds its parts", () => {
    expect(tokenize("createApp")).toEqual(["createapp", "create", "app"]);
  });

  // Bug: an acronym stays glued to the next word, so `element` misses `HTMLElement`.
  it("splits an acronym from the word after it", () => {
    expect(tokenize("HTMLElement")).toEqual(["htmlelement", "html", "element"]);
  });

  // Bug: a digit counts as a word break, so `i18n` becomes `i18` and `n`, and `d1` is lost.
  it("keeps digits inside a word and splits at a capital after a digit", () => {
    expect(tokenize("i18n")).toEqual(["i18n"]);
    expect(tokenize("D1Database")).toEqual(["d1database", "d1", "database"]);
  });

  // Bug: one-letter tokens fill the tables with noise from code like `a.b` and `x => x`.
  it("drops tokens shorter than 2 characters", () => {
    expect(tokenize("a.b x => xy")).toEqual(["xy"]);
  });

  // Bug: stop words fill the shard and make `route the head` require the word `the`.
  it("drops stop words but keeps short domain words", () => {
    expect(tokenize("the route and the head")).toEqual(["route", "head"]);
    expect(tokenize("fx ai ci kv")).toEqual(["fx", "ai", "ci", "kv"]);
  });

  // Bug: Markdown or code punctuation stays on a word, so `route` misses `route()` and `**route**`.
  it("splits on anything that is not a letter or a digit", () => {
    expect(tokenize("**route()**, quick-start snake_case")).toEqual([
      "route",
      "quick",
      "start",
      "snake",
      "case"
    ]);
  });

  // Bug: an accented letter counts as a break, so `café` becomes `caf` and is never found whole.
  it("keeps letters outside ASCII inside a word", () => {
    expect(tokenize("Café")).toEqual(["café"]);
  });

  // Bug: a repeated word scores twice on a query, so `route route` outranks a better match.
  it("returns each token once", () => {
    expect(tokenize("route Route route")).toEqual(["route"]);
  });
});
