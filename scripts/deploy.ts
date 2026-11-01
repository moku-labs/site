/**
 * @file Cloudflare Pages deploy (`bun run deploy`). Thin passthrough to the framework cli plugin.
 * Guided in a terminal: `bun run deploy` runs the interactive setup wizard. Direct and CI-safe when
 * `--cli` is passed or no TTY is attached (the GitHub `app-deploy` workflow runs `bun run deploy`).
 */
import { app } from "../src/app";

const guided = process.stdout.isTTY === true && !process.argv.includes("--cli");

await app.cli.deploy({ guided });
