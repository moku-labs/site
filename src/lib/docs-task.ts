/**
 * @file The docs agent's task, as `scripts/update-docs.ts` hands it to the Claude Agent SDK: the
 * prompt, the options (model, tools, budget) and the report read from its result. Pure; the
 * script only runs `query()` with them.
 */
import type { Options, SDKResultMessage } from "@anthropic-ai/claude-agent-sdk";
import type { PackageBump } from "./package-bumps";

/** The model that writes the docs. */
const DOCS_MODEL = "claude-opus-5-5";

/** Turns before the run stops, a cap far above a normal docs update. */
const DOCS_MAX_TURNS = 80;

/**
 * What the agent may run without asking. With `permissionMode: "dontAsk"` everything else is
 * denied: no network but `gh release`, no shell but the project's checks and read-only git.
 *
 * @example
 * ```ts
 * DOCS_AGENT_TOOLS.includes("Bash(git push:*)"); // false: the workflow pushes, never the agent
 * ```
 */
export const DOCS_AGENT_TOOLS = [
  "Read",
  "Edit",
  "Write",
  "Glob",
  "Grep",
  "Bash(bun run typecheck:*)",
  "Bash(bun run lint:*)",
  "Bash(bun run test:*)",
  "Bash(bunx vitest run:*)",
  "Bash(gh release view:*)",
  "Bash(gh release list:*)",
  "Bash(git diff:*)",
  "Bash(git status:*)",
  "Bash(grep:*)",
  "Bash(ls:*)"
] as const;

/**
 * The task the agent gets: the bumps, and the skill that says how to handle them.
 *
 * @param bumps - The packages the branch moved, at least one.
 * @returns The multi-line prompt: the header, one `- name: from → to` line per bump, then the
 *   update-docs instruction.
 * @example
 * ```ts
 * docsTaskPrompt([{ name: "@moku-labs/game", from: "0.15.92", to: "0.15.95" }]);
 * // "This branch bumps these packages:\n- @moku-labs/game: 0.15.92 → 0.15.95\n…"
 * ```
 */
export function docsTaskPrompt(bumps: PackageBump[]): string {
  const lines = bumps.map(bump => `- ${bump.name}: ${bump.from} → ${bump.to}`);
  return [
    "This branch bumps these packages:",
    ...lines,
    "",
    "Bring content/docs up to date with these releases by the update-docs skill, until typecheck,",
    "lint and test:coverage are green. Then report what you changed."
  ].join("\n");
}

/**
 * The SDK options of one docs run: project settings and the `update-docs` skill loaded, the tool
 * allowlist enforced, and the spend capped.
 *
 * @param budgetUsd - The most one run may cost, in US dollars.
 * @returns The options for `query()`.
 * @example
 * ```ts
 * docsAgentOptions(5).maxBudgetUsd; // 5
 * docsAgentOptions(5).permissionMode; // "dontAsk"
 * ```
 */
export function docsAgentOptions(budgetUsd: number): Options {
  return {
    model: DOCS_MODEL,
    effort: "high",
    permissionMode: "dontAsk",
    allowedTools: [...DOCS_AGENT_TOOLS],
    settingSources: ["project"],
    skills: ["update-docs"],
    maxTurns: DOCS_MAX_TURNS,
    maxBudgetUsd: budgetUsd
  };
}

/**
 * The run's report from its final result message: the agent's summary, or why it stopped, plus
 * what it cost.
 *
 * @param result - The SDK's `result` message.
 * @returns The report text, and `failed` when the run stopped short.
 * @example
 * ```ts
 * // The run hit its $5 budget.
 * docsRunReport({ type: "result", subtype: "error_max_budget_usd", total_cost_usd: 5.01, num_turns: 41, … });
 * // { report: "stopped: error_max_budget_usd\n\nCost: $5.01, 41 turns.", failed: true }
 * ```
 */
export function docsRunReport(result: SDKResultMessage): { report: string; failed: boolean } {
  const succeeded = result.subtype === "success";
  const outcome = succeeded ? result.result : `stopped: ${result.subtype}`;
  const cost = `Cost: $${result.total_cost_usd.toFixed(2)}, ${result.num_turns} turns.`;
  return { report: `${outcome}\n\n${cost}`, failed: !succeeded };
}
