import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { buildPlugin, contentPlugin, createApp, fileSystemContent } from "@moku-labs/web";
import { describe, expect, it, vi } from "vitest";
import { SITE } from "../../../../config";
import { docsPlugin } from "../../../docs";
import { ogPlugin } from "../..";

vi.mock("../../../../data/packages", () => ({
  packages: [
    {
      id: "web",
      name: "@moku-labs/web",
      npm: "@moku-labs/web",
      tagline: "Static site + islands SPA. Same render at build and in the browser",
      group: "Frameworks"
    }
  ]
}));

/** The PNG colour type of a palette image, byte 25 of the file. */
const PNG_PALETTE = 3;

/**
 * Write a docs tree of one package home, one section page and one concepts page.
 *
 * @param root - The temp project directory.
 * @returns The docs directory.
 */
function writeDocs(root: string): string {
  const docs = path.join(root, "docs");
  mkdirSync(path.join(docs, "web", "guides"), { recursive: true });
  mkdirSync(path.join(docs, "concepts"));
  writeFileSync(
    path.join(docs, "web", "index.md"),
    '---\ntitle: "@moku-labs/web"\ndescription: "The web package."\n---\n\nBody.\n'
  );
  writeFileSync(
    path.join(docs, "web", "guides", "routing.md"),
    '---\ntitle: Routing\ndescription: "One typed builder."\nsection: Guides\n---\n\nBody.\n'
  );
  writeFileSync(
    path.join(docs, "concepts", "events.md"),
    '---\ntitle: Events\ndescription: "Typed notifications."\n---\n\nBody.\n'
  );
  return docs;
}

describe("og plugin in a real app", () => {
  // Bug: a font path, an art path or a library call is wrong, so `bun run og` fails only on a
  // person's machine; or the encoder falls back to full colour, and every commit adds megabytes.
  it("draws real palette PNGs of 1200x630 and keeps them on the second run", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "og-app-"));
    const outDir = path.join(root, "og");
    const app = createApp({
      plugins: [contentPlugin, buildPlugin, docsPlugin, ogPlugin],
      pluginConfigs: {
        site: SITE,
        content: { providers: [fileSystemContent({ contentDir: path.join(root, "articles") })] },
        docs: { dir: writeDocs(root) },
        og: { outDir, manifest: path.join(root, "manifest.json") }
      }
    });
    await app.start();

    const cards = await app.og.cards();
    const first = await app.og.write();
    const second = await app.og.write();

    expect(first).toEqual({ drawn: cards.length, kept: 0, removed: 0 });
    expect(second).toEqual({ drawn: 0, kept: cards.length, removed: 0 });
    for (const card of cards) {
      const png = readFileSync(path.join(outDir, card.file));
      expect(png.readUInt32BE(16), card.file).toBe(1200);
      expect(png.readUInt32BE(20), card.file).toBe(630);
      expect(png[25], card.file).toBe(PNG_PALETTE);
    }
    await app.stop();
  });
});
