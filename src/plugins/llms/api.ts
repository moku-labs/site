/**
 * @file API factory of the llms plugin, and the `build:complete` hook handler.
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { SITE } from "../../config";
import { about } from "../../data/about";
import { demos } from "../../data/demos";
import type { PackageEntry } from "../../data/packages";
import { packages } from "../../data/packages";
import { claudeInstallCommands, landingPrompts } from "../../data/prompts";
import { resolvePackages } from "../../lib/packages";
import { docsPlugin } from "../docs";
import type { DocumentPage } from "../docs/types";
import { checkSiteUrl, renderLlmsFiles } from "./render";
import { renderDocumentationHub, renderSitePages } from "./site-pages";
import type {
  LlmsApi,
  LlmsContext,
  LlmsDocument,
  LlmsFile,
  LlmsPackage,
  LlmsSources,
  PendingWrite
} from "./types";

/** The concepts pages describe the kernel, so their release is the installed `@moku-labs/core`. */
const CONCEPTS: PackageEntry = {
  id: "concepts",
  name: "Concepts",
  npm: "@moku-labs/core",
  tagline: "",
  group: "Core"
};

/** The real inputs: site identity, `src/data/*` and the project's `node_modules`. */
const defaultSources: LlmsSources = {
  site: { name: SITE.name, description: SITE.description },
  packages,
  demos,
  about,
  installCommands: claudeInstallCommands,
  prompts: landingPrompts,
  nodeModules: "node_modules"
};

/**
 * The fields of a docs page the renderers read.
 *
 * @param page - A docs page.
 * @returns The renderer page.
 */
function toLlmsPage(page: DocumentPage): LlmsDocument {
  const { path: pagePath, title, description, markdown, pkg } = page;
  return { path: pagePath, title, description, markdown, pkg };
}

/**
 * Resolve the packages that have docs pages, with versions from `node_modules`. Packages without
 * pages are not resolved, so a family member that is not installed yet does not fail the build.
 *
 * @param ids - Package ids that have docs pages.
 * @param sources - The package family and the `node_modules` directory.
 * @returns Resolved packages by id.
 * @throws {Error} When a package with pages is not installed.
 */
function describePackages(
  ids: ReadonlySet<string>,
  sources: LlmsSources
): Map<string, LlmsPackage> {
  const entries = [...sources.packages, CONCEPTS].filter(entry => ids.has(entry.id));
  return new Map(
    resolvePackages(entries, sources.nodeModules).map(entry => [
      entry.id,
      {
        id: entry.id,
        name: entry.name,
        tagline: entry.tagline,
        release: `${entry.npm ?? entry.name}@${entry.version}`
      }
    ])
  );
}

/**
 * Render every file from the docs plugin's pages and the site data.
 *
 * @param ctx - Plugin context: config and `require` for the docs plugin.
 * @param sources - Site identity, data and `node_modules`.
 * @returns The files.
 * @throws {Error} When `siteUrl` is empty or a package with pages is not installed.
 */
async function collectFiles(ctx: LlmsContext, sources: LlmsSources): Promise<LlmsFile[]> {
  const site = { ...sources.site, url: checkSiteUrl(ctx.config.siteUrl) };
  const loaded = await ctx.require(docsPlugin).all();
  const documents = loaded.map(page => toLlmsPage(page));
  const pages = [
    ...renderSitePages(site, sources, new Set(documents.map(page => page.path))),
    renderDocumentationHub(site, sources.packages, documents)
  ];
  const ids = new Set(documents.map(page => page.pkg));
  return renderLlmsFiles({ site, documents, pages, packages: describePackages(ids, sources) });
}

/**
 * Write files under a directory, creating the folders they need.
 *
 * @param files - Files relative to the directory.
 * @param directory - Output directory.
 * @returns How many files were written.
 */
async function writeFiles(files: readonly LlmsFile[], directory: string): Promise<number> {
  await Promise.all(
    files.map(async file => {
      const target = path.join(directory, file.path);
      await mkdir(path.dirname(target), { recursive: true });
      await writeFile(target, file.content);
    })
  );
  return files.length;
}

/**
 * Render every file and write it under a directory.
 *
 * @param ctx - Plugin context: config and `require` for the docs plugin.
 * @param outputDirectory - Output directory.
 * @param sources - Site identity, data and `node_modules`.
 * @returns How many files were written.
 * @throws {Error} When `siteUrl` is empty or a package with pages is not installed.
 */
async function writeLlms(
  ctx: LlmsContext,
  outputDirectory: string,
  sources: LlmsSources
): Promise<{ count: number }> {
  return { count: await writeFiles(await collectFiles(ctx, sources), outputDirectory) };
}

/**
 * Start the write of a finished build and keep it in state, so `write()` for the same directory
 * returns it instead of writing again. Every build starts a fresh write; a failed one is dropped
 * from state, so the next `write()` tries again.
 *
 * @param ctx - Plugin context: config, state, `require` for the docs plugin.
 * @param outputDirectory - The finished build's output directory.
 * @param sources - Site identity, data and `node_modules`; defaults to the real ones.
 * @returns The write, the same promise `write()` hands out.
 */
export function startBuildWrite(
  ctx: LlmsContext,
  outputDirectory: string,
  sources: LlmsSources = defaultSources
): Promise<{ count: number }> {
  const pending: PendingWrite = {
    outDir: outputDirectory,
    promise: writeLlms(ctx, outputDirectory, sources)
  };
  ctx.state.pending = pending;
  pending.promise.catch(() => {
    if (ctx.state.pending === pending) ctx.state.pending = undefined;
  });
  return pending.promise;
}

/**
 * Build the llms API. `files()` renders from `docs.all()` and the site data on every call;
 * `write()` writes the same files, or hands out the write the last build started.
 *
 * @param ctx - Plugin context: config, state, `require` for the docs plugin.
 * @param sources - Site identity, data and `node_modules`; defaults to the real ones.
 * @returns The API mounted at `app.llms`.
 */
export function createLlmsApi(ctx: LlmsContext, sources: LlmsSources = defaultSources): LlmsApi {
  return {
    files: () => collectFiles(ctx, sources),
    write: (outputDirectory = ctx.config.outDir) => {
      // The build's own directory: hand out the write its build:complete hook started.
      const pending = ctx.state.pending;
      if (pending?.outDir === outputDirectory) return pending.promise;

      return writeLlms(ctx, outputDirectory, sources);
    }
  };
}
