/**
 * @file The `search-palette` island.
 */
import { createIsland } from "@moku-labs/web/browser";

/**
 * The ⌘K search palette over the search collection shard. Every `[data-search-open]`
 * button opens it. A shell until the landing wave builds it.
 */
export const searchPaletteIsland = createIsland("search-palette", {});
