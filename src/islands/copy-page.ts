/**
 * @file The `copy-page` island: "Copy as Markdown" on a docs page.
 */
import { createIsland } from "@moku-labs/web/browser";
import { copyText, flashButton } from "./clipboard";

/**
 * Fetch the page's Markdown twin and copy it.
 *
 * @param button - The button; `data-markdown-url` names the `.md` file.
 */
async function copyPage(button: Element): Promise<void> {
  if (!(button instanceof HTMLElement)) return;
  const url = button.dataset.markdownUrl;
  let copied = false;
  if (url !== undefined) {
    try {
      const response = await fetch(url);
      copied = response.ok && (await copyText(await response.text()));
    } catch {
      copied = false;
    }
  }
  flashButton(button, copied);
}

/**
 * Copies the page as Markdown (the same file agents read), then shows "Copied" for 1.6 s.
 */
export const copyPageIsland = createIsland("copy-page", {
  events: {
    click: ctx => {
      void copyPage(ctx.el);
    }
  }
});
