/**
 * Nano tier — the kernel's exact messages for the site pages, captured at build.
 * Emits no events, no state, no lifecycle. Composed only in `src/app.ts` (Node).
 *
 * @see README.md
 */
import { createPlugin } from "@moku-labs/web";
import { createKernelApi } from "./api";

/**
 * The kernel plugin: `app.kernel.errors()` and `app.kernel.trayMessages(tray)` trigger the real
 * kernel through `@moku-labs/web` and return its words. Route loaders reach it by name through
 * `src/lib/kernel-reference.ts`, like the docs plugin.
 *
 * @see README.md
 */
export const kernelPlugin = createPlugin("kernel", {
  api: () => createKernelApi()
});
