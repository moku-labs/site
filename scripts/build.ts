/**
 * @file SSG build entry (`bun run build`). Thin passthrough to the framework cli plugin:
 * `app.cli.build()` runs the full static build into `dist/` and asserts the 404 page exists at the
 * output root (Cloudflare Pages would otherwise flip to SPA mode).
 */
import { app } from "../src/app";

await app.cli.build();
