import { describe, expect, it } from "vitest";
import { demosUsing, usesPackage } from "../../../src/lib/demos";

const demos = [
  { id: "tracker", name: "Tracker", description: "Kanban", stack: ["web", "worker"] },
  { id: "ticktoe", name: "TickToe", description: "Toy box", stack: ["game", "native"] }
];

describe("usesPackage", () => {
  // Bug: "all" hides every card, or a filter matches a package by prefix.
  it("matches every demo for all, and a package only by its exact id", () => {
    expect(usesPackage(["web"], "all")).toBe(true);
    expect(usesPackage(["web", "worker"], "worker")).toBe(true);
    expect(usesPackage(["web"], "we")).toBe(false);
  });
});

describe("demosUsing", () => {
  // Bug: a package no demo uses shows every demo instead of the empty state.
  it("keeps the demos built on a package, none for an unused one", () => {
    expect(demosUsing(demos, "native").map(demo => demo.id)).toEqual(["ticktoe"]);
    expect(demosUsing(demos, "ai")).toEqual([]);
  });
});
