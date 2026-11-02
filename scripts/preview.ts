/**
 * @file Static preview server (`bun run preview`). Thin passthrough to the framework cli plugin:
 * `app.cli.preview()` serves the already-built `dist/` with Cloudflare-Pages-style clean-URL and
 * nearest-404 resolution, with no watch or rebuild. `--port <n>` overrides the configured port
 * (the e2e suite serves on its own port, so a running dev server is never tested by accident).
 */
import { app } from "../src/app";

const portFlag = Bun.argv.indexOf("--port");
const port = portFlag === -1 ? undefined : Number(Bun.argv[portFlag + 1]);

await app.cli.preview(port === undefined || Number.isNaN(port) ? {} : { port });
