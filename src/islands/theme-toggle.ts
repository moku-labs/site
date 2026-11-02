/**
 * @file The `theme-toggle` island: flips `html[data-theme]` and remembers it for the visit.
 */
import { createIsland } from "@moku-labs/web/browser";

/** The sessionStorage key; the inline script in `src/index.html` reads the same key. */
const STORAGE_KEY = "moku-theme";

/** A colour theme. */
type Theme = "light" | "dark";

/**
 * The theme in effect, as the inline script set it.
 *
 * @returns `light` or `dark`.
 */
function currentTheme(): Theme {
  return document.documentElement.dataset.theme === "light" ? "light" : "dark";
}

/**
 * Mirror the theme on the button for assistive tech: pressed means light.
 *
 * @param button - The toggle button.
 */
function syncButton(button: Element): void {
  const light = currentTheme() === "light";
  button.setAttribute("aria-pressed", String(light));
  button.setAttribute("aria-label", light ? "Switch to dark theme" : "Switch to light theme");
}

/**
 * Switch to the other theme, remember it for the visit and update the button.
 *
 * @param button - The toggle button.
 */
function flipTheme(button: Element): void {
  const next: Theme = currentTheme() === "light" ? "dark" : "light";
  document.documentElement.dataset.theme = next;
  try {
    sessionStorage.setItem(STORAGE_KEY, next);
  } catch {
    // Storage is blocked: the choice lasts until the next full page load.
  }
  syncButton(button);
}

/**
 * Light/dark switch in the header. The label needs no script: the sheet shows the one that
 * matches `html[data-theme]`.
 */
export const themeToggleIsland = createIsland("theme-toggle", {
  events: {
    click: ctx => flipTheme(ctx.el)
  },
  onMount: ctx => syncButton(ctx.el)
});
