/**
 * @file SSG build entry (`bun run build`). Thin passthrough to the framework cli plugin:
 * `app.cli.build()` runs the full static build into `dist/` and asserts the 404 page exists at the
 * output root (Cloudflare Pages would otherwise flip to SPA mode). Then the site's own post steps:
 * the search shard and the LLM files (`llms.txt`, one `.md` per docs page) go into `dist/`. The
 * `build:complete` hooks already started both writes; the kernel does not await hooks, so these
 * calls await the same writes instead of writing a second time.
 */
import { app } from "../src/app";

await app.cli.build();
await app.search.write();
await app.llms.write();
