/**
 * @file Clipboard copy and the "Copied" flash, shared by the copy islands. Not an island.
 */

/** How long a copy button shows its result (design F4). */
const FLASH_MS = 1600;

/**
 * Copy text to the clipboard.
 *
 * @param text - The text to copy.
 * @returns `true` when the clipboard took it, `false` when the browser refused.
 * @example
 * ```ts
 * if (await copyText(figure.dataset.copy ?? "")) flashButton(button, "Copied");
 * ```
 */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/**
 * Show a result on a button for 1.6 s, then restore its label. While it shows, the button has
 * `data-copied` (pink) on success or `data-failed` on failure.
 *
 * @param button - The copy button.
 * @param copied - Whether the copy worked.
 * @example
 * ```ts
 * flashButton(button, await copyText(text));
 * ```
 */
export function flashButton(button: HTMLElement, copied: boolean): void {
  button.dataset.label ??= button.textContent ?? "";
  const label = button.dataset.label;
  const state = copied ? "copied" : "failed";
  button.textContent = copied ? "Copied" : "Copy failed";
  button.dataset[state] = "";
  setTimeout(() => {
    button.textContent = label;
    delete button.dataset[state];
  }, FLASH_MS);
}
