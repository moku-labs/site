/**
 * @file The ⌘K search modal (E1), paired with the `search-palette` island. Rendered once in the
 * persistent site chrome, hidden until ⌘K, Ctrl+K or a `[data-search-open]` button opens it.
 */
import type { VNode } from "preact";
import { SEARCH_INDEX } from "../config";
import type { UrlBuilder } from "../lib/url-builder";
import { CubeIcon } from "./cube-icon";
import { SearchIcon } from "./icons";

/**
 * The pages suggested before the visitor types.
 *
 * @param url - Route link builder.
 * @returns Their hrefs, in display order.
 */
function suggestedPages(url: UrlBuilder): string[] {
  return [
    url("docsPage", { pkg: "web", page: "quick-start" }),
    url("docsDeep", { pkg: "web", section: "guides", page: "routing" }),
    url("docsDeep", { pkg: "web", section: "plugins", page: "content" }),
    url("docsPage", { pkg: "concepts", page: "kernel-checks" }),
    url("docsDeep", { pkg: "web", section: "guides", page: "islands" })
  ];
}

/**
 * The search modal: input, results list, status line and key hints. The island fills the list
 * from the search shard and clones the generic icons from the hidden icon set.
 *
 * @param props - Component props.
 * @param props.url - Route link builder.
 * @returns The `<div data-component="search-palette" data-island="search-palette">`.
 * @example
 * ```tsx
 * <SearchPalette url={ctx.url} />
 * ```
 */
export function SearchPalette(props: { url: UrlBuilder }): VNode {
  const islandData = { ...SEARCH_INDEX, suggested: suggestedPages(props.url) };
  return (
    <div
      data-component="search-palette"
      data-island="search-palette"
      data-props={JSON.stringify(islandData)}
      hidden
    >
      <div data-part="backdrop" data-close="" />
      <div data-part="panel" role="dialog" aria-modal="true" aria-label="Search docs">
        <div data-part="field">
          <SearchIcon size={18} />
          <input
            type="text"
            role="combobox"
            aria-expanded="true"
            aria-controls="search-results"
            aria-autocomplete="list"
            aria-label="Search docs"
            placeholder="Search packages, guides, plugins, APIs"
            autocomplete="off"
            spellcheck={false}
          />
          <kbd>esc</kbd>
        </div>
        <p data-part="label">Suggested</p>
        <div id="search-results" data-part="results" role="listbox" aria-label="Results" />
        <p data-part="status" role="status" />
        <div data-part="foot">
          <span>↑ ↓ move</span>
          <span>enter opens</span>
          <span>Every page is also plain text in llms.txt</span>
        </div>
      </div>
      <div data-part="icons" hidden>
        <span data-icon="concept">
          <CubeIcon tone="docs" glyph="layers" size={30} />
        </span>
        <span data-icon="demo">
          <CubeIcon tone="docs" glyph="plug" size={30} />
        </span>
        <span data-icon="page">
          <CubeIcon tone="docs" glyph="page" size={30} />
        </span>
      </div>
    </div>
  );
}
