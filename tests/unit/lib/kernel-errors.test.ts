import { describe, expect, it } from "vitest";
import {
  captureKernelErrors,
  captureTrayMessages,
  type KernelScenario
} from "../../../src/lib/kernel-errors";

/** The plugin (or call) each real scenario is about; its message must name it. */
const subjects: Record<string, string> = {
  "duplicate-name": '"auth"',
  "missing-dependency": '"auth" is not registered',
  "dependency-order": '"auth" appears after "billing"',
  "reserved-name": '"start"',
  "core-plugin-clash": '"log"',
  "events-object": '"analytics"',
  "double-start": "start()"
};

describe("captureKernelErrors", () => {
  // Bug: a scenario stops throwing, throws for the wrong reason (for example a missing
  // site config makes every createApp fail with the same message), or loses its async
  // rejection. Each message must be the kernel's own, distinct, and about its scenario.
  it("captures a distinct kernel message for every check, in display order", async () => {
    const errors = await captureKernelErrors();

    expect(errors.map(error => [error.id, error.when])).toEqual([
      ["duplicate-name", "createApp"],
      ["missing-dependency", "createApp"],
      ["dependency-order", "createApp"],
      ["reserved-name", "createApp"],
      ["core-plugin-clash", "createApp"],
      ["events-object", "createPlugin"],
      ["double-start", "start"]
    ]);
    expect(new Set(errors.map(error => error.message)).size).toBe(errors.length);
    for (const error of errors) {
      expect(error.message).toMatch(/^\[web\] [^\n]+\n {2}\S/);
      expect(error.message).toContain(subjects[error.id]);
      expect(error.hint.length).toBeGreaterThan(0);
    }
  });

  // Bug: a check the kernel dropped is published with an empty message instead of failing the build.
  it("throws when a scenario no longer throws", async () => {
    const quiet: KernelScenario = {
      id: "quiet",
      when: "createApp",
      hint: "None.",
      trigger: () => 1
    };

    await expect(captureKernelErrors([quiet])).rejects.toThrow(
      '[site] kernel check "quiet" no longer throws.\n  The kernel changed: update the scenario in src/lib/kernel-errors.ts.'
    );
  });

  // Bug: a thrown non-Error is published as "undefined".
  it("throws when a scenario throws something that is not an Error", async () => {
    const odd: KernelScenario = {
      id: "odd",
      when: "start",
      hint: "None.",
      trigger: () => Promise.reject("text")
    };

    await expect(captureKernelErrors([odd])).rejects.toThrow(
      '[site] kernel check "odd" threw a value that is not an Error.'
    );
  });
});

describe("captureTrayMessages", () => {
  // Bug: a hero message is retyped instead of captured, or a check is pinned on the wrong plugin:
  // the hero then prints words the kernel never says for that list.
  it("captures the kernel's own message for every check a tray plugin can fail", async () => {
    const messages = await captureTrayMessages([
      { plugin: "router" },
      { plugin: "router" },
      { plugin: "auth", depends: "session" },
      { plugin: "session" },
      { plugin: "start" }
    ]);

    expect(Object.keys(messages.reserved)).toEqual(["start"]);
    expect(messages.reserved.start).toMatch(/^\[web\] Plugin name "start" [^\n]+\n {2}\S/);
    expect(Object.keys(messages.duplicate)).toEqual(["router", "auth", "session"]);
    expect(messages.duplicate.router).toMatch(/^\[web\] [^\n]*"router"[^\n]*\n {2}\S/);
    expect(messages.duplicate.auth).toContain('"auth"');
    expect(Object.keys(messages.missing)).toEqual(["auth"]);
    expect(messages.missing.auth).toMatch(
      /^\[web\] Plugin "auth" depends on "session"[^\n]*\n {2}\S/
    );
    expect(messages.missing.auth).not.toBe(messages.duplicate.auth);
  });
});
