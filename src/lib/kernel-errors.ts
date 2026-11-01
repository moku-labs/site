/**
 * @file Captures the kernel's real error messages by triggering each check.
 *
 * Build-time only. Every scenario runs `createApp` / `createPlugin` from `@moku-labs/web`
 * and records the exact `error.message`, so the site never retypes a kernel error.
 */

/** When a kernel check runs. */
export type KernelCheckPhase = "createPlugin" | "createApp" | "start";

/** One kernel check and the exact message it prints. */
export type KernelError = {
  /** Stable id, e.g. `duplicate-name`. */
  id: string;
  /** Phase the check runs in. */
  when: KernelCheckPhase;
  /** The exact message thrown by the kernel. */
  message: string;
  /** One-line fix shown next to the message. */
  hint: string;
};

/**
 * Trigger every kernel check and return the messages in display order.
 *
 * @throws {Error} When a scenario no longer throws, which means the kernel changed.
 */
export function captureKernelErrors(): KernelError[] {
  throw new Error("not implemented");
}
