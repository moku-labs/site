/**
 * @file Server-side error gate: after the run, scan the e2e server's teed stdout and stderr
 * (`.e2e-server.log`, written by the webServer command) and fail on any error-level line.
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const LOG = path.join(import.meta.dirname, "../../.e2e-server.log");

/** Lines that mean the build or the server went wrong. */
const ERROR_LINE =
  /\b(error|exception|unhandled|uncaught|panic|EADDRINUSE)\b|✗|✕|\b5\d\d\b(?=.*\/)/i;

/**
 * Fail the run when the server logged an error.
 *
 * @throws {Error} One line per server error.
 */
export default function globalTeardown() {
  if (!existsSync(LOG)) return;
  const bad = readFileSync(LOG, "utf8")
    .split("\n")
    .filter(line => ERROR_LINE.test(line));
  if (bad.length > 0) throw new Error(`e2e server logged errors:\n${bad.join("\n")}`);
}
