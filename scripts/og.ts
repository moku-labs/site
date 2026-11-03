/**
 * @file Share card entry (`bun run og`). Draws the card of every page whose input changed into
 * `public/og/`, deletes the card of a removed page and updates `src/data/og-manifest.json`. The
 * cards are committed: `bun run build` and CI only copy them.
 */
import { app } from "../src/app";

const { drawn, kept, removed } = await app.og.write();

console.info(`og: drawn ${drawn}, kept ${kept}, removed ${removed}`); // @log-sink the run's result
