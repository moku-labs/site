/**
 * @file Static preview server (`bun run preview`). Thin passthrough to the framework cli plugin:
 * `app.cli.preview()` serves the already-built `dist/` with Cloudflare-Pages-style clean-URL and
 * nearest-404 resolution, with no watch or rebuild.
 */
import { app } from "../src/app";

await app.cli.preview();
