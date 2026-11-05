/**
 * @file Docs update entry (`bun run docs:update`). Finds the `@moku-labs/*` packages this branch
 * bumped against `origin/main` and runs the `update-docs` skill headless through the Claude Agent
 * SDK, so the docs follow the release. Billed to `ANTHROPIC_API_KEY`, capped by
 * `DOCS_BUDGET_USD` (default 5). Run by `.github/workflows/docs-update.yml` on a red Dependabot PR;
 * it edits files and leaves the commit to the caller.
 */
import { appendFile, readFile } from "node:fs/promises";
import { query } from "@anthropic-ai/claude-agent-sdk";
import { $ } from "bun";
import { app } from "../src/app";
import { docsAgentOptions, docsRunReport, docsTaskPrompt } from "../src/lib/docs-task";
import { packageBumps } from "../src/lib/package-bumps";

const DEFAULT_BUDGET_USD = "5";

/**
 * Prints the run's report and mirrors it to the GitHub Actions job summary when there is one.
 *
 * @param report - The report from `docsRunReport`.
 * @returns Resolves once the report is printed and, when a job summary file exists, appended to it.
 */
async function publishRunReport(report: string): Promise<void> {
  console.info(report); // @log-sink the agent's report
  const summaryFile = app.env.get("GITHUB_STEP_SUMMARY");
  if (summaryFile) await appendFile(summaryFile, `## Docs update\n\n${report}\n`);
}

// Which moku packages this branch moved against the base, and how much one run may spend.
const baseReference = app.env.get("DOCS_BASE_REF") ?? "origin/main";
const budgetUsd = Number(app.env.get("DOCS_BUDGET_USD") ?? DEFAULT_BUDGET_USD);
const baseManifest = await $`git show ${baseReference}:package.json`.text();
const bumps = packageBumps(baseManifest, await readFile("package.json", "utf8"));

if (bumps.length === 0) {
  console.info(`docs:update: no @moku-labs/* bump against ${baseReference}, nothing to do`); // @log-sink the run's result
} else {
  // A stream that ends with no result message is a failed run, not a quiet success.
  process.exitCode = 1;
  const run = query({ prompt: docsTaskPrompt(bumps), options: docsAgentOptions(budgetUsd) });
  for await (const message of run) {
    if (message.type !== "result") continue;
    const { report, failed } = docsRunReport(message);
    await publishRunReport(report);
    process.exitCode = failed ? 1 : 0;
  }
}
