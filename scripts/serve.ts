/**
 * @file Dev loop (`bun run dev`). Thin passthrough to the framework cli plugin: `cli.serve()`
 * builds once, serves the output dir, then watches `src/` and rebuilds on change with live reload.
 */
import { app } from "../src/app";

await app.cli.serve();
