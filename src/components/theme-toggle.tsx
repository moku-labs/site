/**
 * @file The light/dark switch of the header, paired with the `theme-toggle` island.
 */
import type { VNode } from "preact";
import { ThemeCubeIcon } from "./icons";

/**
 * The theme button. It names the theme it switches to; the sheet shows the label that matches
 * `html[data-theme]`, so the label is right before the island mounts.
 *
 * @returns The `<button data-island="theme-toggle">`.
 * @example
 * ```tsx
 * <ThemeToggle />
 * ```
 */
export function ThemeToggle(): VNode {
  return (
    <button
      type="button"
      data-island="theme-toggle"
      data-part="theme"
      aria-pressed="false"
      aria-label="Switch theme"
    >
      <ThemeCubeIcon />
      <span data-part="label" data-to="light">
        Light
      </span>
      <span data-part="label" data-to="dark">
        Dark
      </span>
    </button>
  );
}
