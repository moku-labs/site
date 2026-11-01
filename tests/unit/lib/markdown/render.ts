import { app } from "../../../../src/app";

/**
 * Render Markdown through the site's real content pipeline: the framework defaults plus the
 * plugins `src/app.ts` wires in. A test through here also proves the wiring.
 */
export function render(markdown: string): Promise<string> {
  return app.content.renderMarkdown(markdown);
}
