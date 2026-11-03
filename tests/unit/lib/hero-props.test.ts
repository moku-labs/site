import { describe, expect, it } from "vitest";
import { goals } from "../../../src/data/assembly";
import { parseHeroData } from "../../../src/lib/hero-props";

const versions = { core: "1.0.1", common: "2.0.2", web: "3.0.3", worker: "4.0.4", game: "5.0.5" };

describe("parseHeroData", () => {
  // Bug: valid props are rejected and the hero stays at its first paint for everyone.
  it("returns the goals and the versions the hero rendered", () => {
    const parsed = parseHeroData(JSON.stringify({ goals, versions }));

    expect(parsed?.goals.map(goal => goal.id)).toEqual(["site", "app", "game"]);
    expect(parsed?.goals[0]?.finalCode).toEqual(goals[0]?.finalCode);
    expect(parsed?.versions).toEqual(versions);
  });

  // Bug: half-formed props reach the rules and the island throws on the first drop.
  it("rejects props without goals, with a broken goal, or with a missing version", () => {
    const { game: _game, ...noGame } = versions;
    const brokenGoal = { ...goals[0], pieces: "content" };

    expect(parseHeroData(JSON.stringify({ goals: [], versions }))).toBeUndefined();
    expect(parseHeroData(JSON.stringify({ goals: [brokenGoal], versions }))).toBeUndefined();
    expect(parseHeroData(JSON.stringify({ goals: [{ ...goals[0], app: [] }], versions }))).toBe(
      undefined
    );
    expect(parseHeroData(JSON.stringify({ goals, versions: noGame }))).toBeUndefined();
    expect(parseHeroData(JSON.stringify([goals]))).toBeUndefined();
  });

  // Bug: a goal list of plain strings passes the guard, and the island throws on the first paint.
  it("rejects goals that are not goal objects", () => {
    expect(parseHeroData(JSON.stringify({ goals: ["x"], versions }))).toBeUndefined();
  });

  // Bug: a broken attribute throws during mount instead of leaving the hero at its first paint.
  it("returns undefined for a missing or unparsable attribute", () => {
    expect(parseHeroData(undefined)).toBeUndefined();
    expect(parseHeroData("{goals:")).toBeUndefined();
  });
});
