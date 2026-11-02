/**
 * @file Types of the kernel plugin.
 */
import type { KernelError, TrayMessages, TrayRule } from "../../lib/kernel-errors";

/**
 * The kernel's own words for the site (`app.kernel`). Build-time only: route loaders reach it
 * through `ctx.require(kernelReference)`, so the kernel scenarios never enter the client bundle.
 */
export type KernelApi = {
  /**
   * Trigger every kernel check and return the exact messages, in display order.
   *
   * @returns One entry per check: id, phase, the kernel's message and a one-line fix.
   * @throws {Error} When a check no longer throws, which means the kernel changed.
   * @example
   * ```ts
   * // In the home route's loader, for the "kernel says no" cards:
   * const errors = await ctx.require(kernelReference).errors();
   * errors.find(error => error.id === "reserved-name")?.message; // '[web] Plugin name "start" conflicts with a reserved app method.\n  Choose a different plugin name.'
   * ```
   */
  errors(): Promise<KernelError[]>;
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
