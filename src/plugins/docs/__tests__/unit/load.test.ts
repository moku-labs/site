import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import type { KernelError } from "../../../../lib/kernel-errors";
import { loadDocuments } from "../../load";
import { KERNEL_ERRORS_MARKER } from "../../markdown";

/**
 * A docs root holding the given files.
 *
 * @param files - File contents by path relative to the root.
 * @returns The root directory.
 */
function docsRoot(files: Record<string, string>): string {
  const root = mkdtempSync(path.join(tmpdir(), "docs-load-"));
  for (const [file, contents] of Object.entries(files)) {
    mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    writeFileSync(path.join(root, file), contents);
  }
  return root;
}

const page = (title: string, body: string): string =>
  `---\ntitle: ${title}\ndescription: ${title}.\n---\n\n${body}\n`;

const ERRORS: KernelError[] = [
  { id: "duplicate-name", when: "createApp", message: "[moku] Duplicate.", hint: "Rename." }
];

describe("loadDocuments", () => {
  // Bug: every page with the marker builds the kernel scenarios again, so one build runs them
  // once per page.
  it("captures the kernel errors once for the whole tree", async () => {
    const capture = vi.fn(async () => ERRORS);
    const pages = await loadDocuments({
      directory: docsRoot({
        "concepts/a.md": page("A", KERNEL_ERRORS_MARKER),
        "concepts/b.md": page("B", KERNEL_ERRORS_MARKER)
      }),
      packageOrder: ["concepts"],
      render: async markdown => markdown,
      capture
    });

    expect(capture).toHaveBeenCalledTimes(1);
    expect([...pages.values()].map(entry => entry.markdown.includes("[moku] Duplicate."))).toEqual([
      true,
      true
    ]);
  });

  // Bug: a route loader changes a cached page or its TOC, and every later route renders the change.
  it("freezes each page and its headings", async () => {
    const pages = await loadDocuments({
      directory: docsRoot({ "concepts/a.md": page("A", "## Setup") }),
      packageOrder: ["concepts"],
      render: async markdown => markdown,
      capture: async () => []
    });
    const loaded = pages.get("/docs/concepts/a/");

    expect(loaded?.title).toBe("A");
    expect(Object.isFrozen(loaded)).toBe(true);
    expect(Object.isFrozen(loaded?.headings)).toBe(true);
  });
});
