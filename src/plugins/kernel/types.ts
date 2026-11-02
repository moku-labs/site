/**
 * @file Types of the kernel plugin.
 */
import type { TrayMessages, TrayRule } from "../../lib/kernel-errors";

/**
 * The kernel's own words for the site (`app.kernel`). Build-time only: route loaders reach it
 * through `ctx.require(kernelReference)`, so the kernel scenarios never enter the client bundle.
 */
export type KernelApi = {
  /**
   * Capture the kernel's messages for the hero tray, using the tray's own plugin names.
   *
   * @param tray - The tray plugins: names and dependencies.
   * @returns The messages by check and plugin name.
   * @throws {Error} When a check no longer throws, which means the kernel changed.
   * @example
   * ```ts
   * const messages = await ctx.require(kernelReference).trayMessages(trayPlugins);
   * messages.missing.auth; // '[web] Plugin "auth" depends on "session", but "session" is not registered.\n  Add "session" to your plugin list before "auth".'
   * ```
   */
  trayMessages(tray: readonly TrayRule[]): Promise<TrayMessages>;
};
