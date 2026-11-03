import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import type { PackageEntry } from "../../../../data/packages";
import { createOgApi } from "../../api";
import type { DrawCard, OgCard, OgContext, OgPage } from "../../types";

// Bug: `render.ts` or another plugin file imports a drawing library at its top: the normal build
// and the CI then load native modules for cards they never draw. A module load fails this file.
vi.mock("satori", () => {
  throw new Error("satori was loaded");
});
vi.mock("@resvg/resvg-js", () => {
  throw new Error("resvg was loaded");
});
vi.mock("sharp", () => {
  throw new Error("sharp was loaded");
});

const web: PackageEntry = {
  id: "web",
  name: "@moku-labs/web",
  npm: "@moku-labs/web",
  tagline: "Web.",
  group: "Frameworks"
};

const quickStart: OgPage = {
  path: "/docs/web/quick-start/",
  pkg: "web",
  slug: "quick-start",
  section: undefined,
  group: "Get started",
  title: "Quick start",
  description: "Start here."
};

const SITE_CARDS = 4;

/**
 * Set the installed version of `web` in a temp `node_modules`.
 *
 * @param nodeModules - The temp directory.
 * @param version - The version to install.
 */
function install(nodeModules: string, version: string): void {
  const directory = path.join(nodeModules, "@moku-labs", "web");
  mkdirSync(directory, { recursive: true });
  writeFileSync(path.join(directory, "package.json"), JSON.stringify({ version }));
}

/**
 * Build the API over temp directories, a page list the test can edit and a fake drawing.
 *
 * @returns The API, its fake drawing and the temp paths.
 */
function setup() {
  const root = mkdtempSync(path.join(tmpdir(), "og-api-"));
  const outDir = path.join(root, "og");
  const manifest = path.join(root, "manifest.json");
  const nodeModules = path.join(root, "node_modules");
  install(nodeModules, "1.0.0");
  const pages = [quickStart];
  const ctx: OgContext = {
    config: { outDir, manifest },
    require: () => ({ all: () => Promise.resolve(pages as never) })
  };
  const draw = vi.fn<DrawCard>((card: OgCard) =>
    Promise.resolve(new TextEncoder().encode(card.title))
  );
  const createDrawer = vi.fn(() => Promise.resolve(draw));
  const api = createOgApi(ctx, { packages: [web], nodeModules, createDrawer });
  return { api, draw, createDrawer, outDir, manifest, nodeModules, pages };
}

describe("og api", () => {
  // Bug: `cards()` needs a drawing library or writes to disk: the fast test would draw.
  it("cards() lists the cards without creating a drawing or a file", async () => {
    const { api, createDrawer, outDir } = setup();

    const cards = await api.cards();

    expect(cards.map(card => card.path)).toContain("/docs/web/quick-start/");
    expect(createDrawer).not.toHaveBeenCalled();
    expect(existsSync(outDir)).toBe(false);
  });

  // Bug: a nested folder is not created, a PNG lands elsewhere, or the manifest is not written.
  it("write() draws every card of a first run into nested folders and records them", async () => {
    const { api, outDir, manifest } = setup();

    const result = await api.write();

    expect(result).toEqual({ drawn: SITE_CARDS + 1, kept: 0, removed: 0 });
    expect(readFileSync(path.join(outDir, "docs/web/quick-start.png"), "utf8")).toBe("Quick start");
    expect(Object.keys(JSON.parse(readFileSync(manifest, "utf8")) as object)).toContain(
      "docs/web/quick-start.png"
    );
  });

  // Bug: a run with nothing to do draws again, or loads Satori, sharp and the fonts for nothing.
  it("write() draws nothing and loads no drawing on a second run", async () => {
    const { api, draw, createDrawer } = setup();
    await api.write();
    draw.mockClear();
    createDrawer.mockClear();

    const result = await api.write();

    expect(result).toEqual({ drawn: 0, kept: SITE_CARDS + 1, removed: 0 });
    expect(draw).not.toHaveBeenCalled();
    expect(createDrawer).not.toHaveBeenCalled();
  });

  // Bug: a version bump keeps the old chip on every shared card of the package.
  it("write() redraws only the cards a version bump changes", async () => {
    const { api, draw, nodeModules } = setup();
    await api.write();
    draw.mockClear();
    install(nodeModules, "2.0.0");

    const result = await api.write();

    expect(result).toEqual({ drawn: 1, kept: SITE_CARDS, removed: 0 });
    expect(draw.mock.calls.map(([card]) => card.path)).toEqual(["/docs/web/quick-start/"]);
  });

  // Bug: a removed page leaves its PNG committed, or its entry in the manifest.
  it("write() deletes the PNG and the entry of a removed page", async () => {
    const { api, outDir, manifest, pages } = setup();
    await api.write();
    pages.pop();

    const result = await api.write();

    expect(result).toEqual({ drawn: 0, kept: SITE_CARDS, removed: 1 });
    expect(existsSync(path.join(outDir, "docs/web/quick-start.png"))).toBe(false);
    expect(readFileSync(manifest, "utf8")).not.toContain("quick-start");
  });

  // Bug: a drawing that fails still records the card as drawn, and the next run keeps the hole.
  it("write() records nothing when a drawing fails, so the next run tries again", async () => {
    const { api, draw, manifest } = setup();
    draw.mockRejectedValueOnce(new Error("no font"));

    await expect(api.write()).rejects.toThrow("no font");

    expect(existsSync(manifest)).toBe(false);
  });
});
