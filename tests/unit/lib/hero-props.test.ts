import { describe, expect, it } from "vitest";
import { parseHeroData } from "../../../src/lib/hero-props";

describe("parseHeroData", () => {
  // Bug: valid props are rejected and the hero stays static for everyone.
  it("returns the props when tray, messages and seed are present", () => {
    const json = JSON.stringify({ tray: [{ id: "router" }], messages: {}, seed: ["router"] });

    expect(parseHeroData(json)).toEqual({
      tray: [{ id: "router" }],
      messages: {},
      seed: ["router"]
    });
  });

  // Bug: half-formed props reach the reducer and the island throws on the first plug.
  it("rejects props with a missing or wrong-typed field", () => {
    expect(parseHeroData(JSON.stringify({ tray: [], messages: {} }))).toBeUndefined();
    expect(parseHeroData(JSON.stringify({ tray: {}, messages: {}, seed: [] }))).toBeUndefined();
    expect(parseHeroData(JSON.stringify({ tray: [], messages: "x", seed: [] }))).toBeUndefined();
    expect(parseHeroData("[]")).toBeUndefined();
  });

  // Bug: a broken attribute throws during mount instead of leaving the hero static.
  it("returns undefined for a missing or unparsable attribute", () => {
    expect(parseHeroData(undefined)).toBeUndefined();
    expect(parseHeroData("{tray:")).toBeUndefined();
  });
});
