/**
 * @file The kernel plugin's API: the capture helpers of `src/lib/kernel-errors.ts`.
 */
import { captureKernelErrors, captureTrayMessages } from "../../lib/kernel-errors";
import type { KernelApi } from "./types";

/**
 * Build the kernel API. Every call triggers the real kernel again, so a build never shows a
 * message from an older kernel.
 *
 * @returns The API.
 */
export function createKernelApi(): KernelApi {
  return {
    errors: () => captureKernelErrors(),
    trayMessages: tray => captureTrayMessages(tray)
  };
}
