/**
 * @file Loads the docs tree: walks the dir, parses, renders and sorts every page.
 */
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import type { KernelError } from "../../lib/kernel-errors";
import { parseFrontmatter } from "./frontmatter";
import { expandKernelErrors, extractHeadings } from "./markdown";
import { CONCEPTS_PACKAGE, type DocumentLocation, locateDocument } from "./tree";
import type { DocumentPage } from "./types";

/** What `loadDocuments` needs from the outside. */
export type LoadOptions = {
  /** Docs root, relative to the working directory or absolute. */
  directory: string;
  /** Allowed package ids in display order, `concepts` included. */
  packageOrder: readonly string[];
  /** Markdown to HTML, the content plugin's renderer. */
  render: (markdown: string) => Promise<string>;
  /** Resolves the kernel errors; called only when a page has the marker. */
  capture: () => Promise<readonly KernelError[]>;
};

/** A docs file with its location, before it is read. */
type LocatedFile = DocumentLocation & {
  /** Path relative to the docs root. */
  relativeFile: string;
  /** Path relative to the working directory, used in messages and `DocumentPage.file`. */
  file: string;
};

/**
 * Every `.md` file under the docs root, relative to it, with `/` separators, sorted.
 *
 * @param directory - Docs root.
 * @returns Relative file paths.
 * @throws {Error} When the docs root cannot be read.
 */
async function listMarkdownFiles(directory: string): Promise<string[]> {
  let entries: string[];
  try {
    entries = await readdir(directory, { recursive: true });
  } catch {
    throw new Error(
      `[docs] The docs directory "${directory}" cannot be read.\n  Create it or set pluginConfigs.docs.dir.`
    );
  }
  return entries
    .map(entry => entry.split(path.sep).join("/"))
    .filter(entry => entry.endsWith(".md"))
    .toSorted();
}

/**
 * Nav group of a page without a `section` field.
 *
 * @param pkg - Package id.
 * @returns `Concepts` for the concepts pages, `Get started` for a package.
 * @example
 * ```ts
 * defaultGroup("web"); // "Get started"
 * ```
 */
function defaultGroup(pkg: string): string {
  return pkg === CONCEPTS_PACKAGE ? "Concepts" : "Get started";
}

/**
 * Read, parse and render one located file.
 *
 * @param located - The file and its location.
 * @param options - Loader inputs.
 * @param capture - Memoized kernel-error capture.
 * @returns The frozen page.
 */
async function readPage(
  located: LocatedFile,
  options: LoadOptions,
  capture: () => Promise<readonly KernelError[]>
): Promise<DocumentPage> {
  const { relativeFile, file, ...location } = located;
  const source = await readFile(path.resolve(options.directory, relativeFile), "utf8");
  const { data, body } = parseFrontmatter(source, file);
  const markdown = await expandKernelErrors(body, capture);
  const html = await options.render(markdown);
  return Object.freeze({
    ...location,
    title: data.title,
    description: data.description,
    order: data.order ?? 0,
    group: data.section ?? defaultGroup(location.pkg),
    drift: data.drift,
    full: data.full ?? false,
    ...(data.kind === undefined ? {} : { kind: data.kind }),
    markdown,
    html,
    headings: Object.freeze(extractHeadings(markdown)),
    file
  });
}

/**
 * Sort pages by package order, then group, then `order`, then title. A group's place inside its
 * package is where it is first seen when the package's pages are sorted by `order` and title.
 *
 * @param pages - Pages in any order.
 * @param packageOrder - Package ids in display order.
 * @returns A new sorted array.
 */
export function sortPages(
  pages: readonly DocumentPage[],
  packageOrder: readonly string[]
): DocumentPage[] {
  const byOrder = pages.toSorted(
    (left, right) => left.order - right.order || left.title.localeCompare(right.title, "en")
  );
  const groupRank = new Map<string, number>();
  for (const page of byOrder) {
    const key = `${page.pkg}\n${page.group}`;
    if (!groupRank.has(key)) groupRank.set(key, groupRank.size);
  }
  const rank = (page: DocumentPage): number => groupRank.get(`${page.pkg}\n${page.group}`) ?? 0;
  return byOrder.toSorted(
    (left, right) =>
      packageOrder.indexOf(left.pkg) - packageOrder.indexOf(right.pkg) || rank(left) - rank(right)
  );
}

/**
 * Load every docs page under the root. Every file is located before any is read, so a misplaced
 * file fails the build at once, naming the file.
 *
 * @param options - Loader inputs.
 * @returns Pages by URL path, in display order.
 * @throws {Error} On an unreadable root, a misplaced file, or invalid frontmatter.
 */
export async function loadDocuments(options: LoadOptions): Promise<Map<string, DocumentPage>> {
  const relativeFiles = await listMarkdownFiles(options.directory);
  const located = relativeFiles.map((relativeFile): LocatedFile => {
    const absolute = path.resolve(options.directory, relativeFile);
    const file = path.relative(process.cwd(), absolute).split(path.sep).join("/");
    return { ...locateDocument(relativeFile, options.packageOrder, file), relativeFile, file };
  });

  let captured: Promise<readonly KernelError[]> | undefined;
  const capture = (): Promise<readonly KernelError[]> => {
    captured ??= options.capture();
    return captured;
  };
  const pages = await Promise.all(located.map(entry => readPage(entry, options, capture)));
  return new Map(sortPages(pages, options.packageOrder).map(page => [page.path, page]));
}
