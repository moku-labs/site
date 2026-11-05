import type { SDKResultMessage } from "@anthropic-ai/claude-agent-sdk";
import { describe, expect, it } from "vitest";
import { docsAgentOptions, docsRunReport, docsTaskPrompt } from "../../../src/lib/docs-task";

/**
 * A result message with the fields the report reads; the rest of the SDK shape is irrelevant here.
 *
 * @param fields - The message fields under test.
 * @param fields.subtype - `success` or an error subtype.
 * @param fields.result - The agent's summary, for a success.
 * @returns The message.
 */
function result(fields: { subtype: string; result?: string }): SDKResultMessage {
  return { type: "result", total_cost_usd: 1.234, num_turns: 12, ...fields } as SDKResultMessage;
}

describe("docsTaskPrompt", () => {
  // Bug: the agent is not told which packages moved, and reads the notes of the wrong ones.
  it("names every bump with both versions", () => {
    const prompt = docsTaskPrompt([
      { name: "@moku-labs/game", from: "0.15.92", to: "0.15.95" },
      { name: "@moku-labs/room", from: "0.8.10", to: "0.8.18" }
    ]);
    expect(prompt).toContain("- @moku-labs/game: 0.15.92 → 0.15.95");
    expect(prompt).toContain("- @moku-labs/room: 0.8.10 → 0.8.18");
  });
});

describe("docsAgentOptions", () => {
  // Bug: the run ignores the budget, or runs any shell command it decides on.
  it("caps the spend and denies every tool outside the allowlist", () => {
    const options = docsAgentOptions(5);
    expect(options.maxBudgetUsd).toBe(5);
    expect(options.permissionMode).toBe("dontAsk");
    expect(options.allowedTools).not.toContain("Bash");
  });

  // Bug: the agent never sees CLAUDE.md or the update-docs skill, and edits the docs blind.
  it("loads the project settings and the update-docs skill", () => {
    const options = docsAgentOptions(5);
    expect(options.settingSources).toEqual(["project"]);
    expect(options.skills).toEqual(["update-docs"]);
  });
});

describe("docsRunReport", () => {
  // Bug: a run that hit its budget passes, and a half-done docs change is pushed.
  it("fails a run that stopped short and says why", () => {
    const { report, failed } = docsRunReport(result({ subtype: "error_max_budget_usd" }));
    expect(failed).toBe(true);
    expect(report).toContain("stopped: error_max_budget_usd");
  });

  // Bug: the summary loses the agent's own report, or the cost a person checks it by.
  it("keeps the agent's summary and the cost of a finished run", () => {
    const { report, failed } = docsRunReport(
      result({ subtype: "success", result: "Documented RoomFullError." })
    );
    expect(failed).toBe(false);
    expect(report).toBe("Documented RoomFullError.\n\nCost: $1.23, 12 turns.");
  });
});
