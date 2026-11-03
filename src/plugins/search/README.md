# search

Standard-tier Layer-3 plugin. Builds the ⌘K index from docs pages (title, description, h2 and h3
sections, page text, code), packages, demos and fixed pages, and writes it with its lookup tables as
one `collection` shard after every build. The browser answers every query from that file, with no
server. No events, no lifecycle. State holds the write the last build started.

## Config

| Option | Type | Default | Description |
|---|---|---|---|
| `collection` | `string` | `"search"` | Collection name |
| `shard` | `string` | `"en"` | Shard name |
| `outDir` | `string` | `"dist"` | Build output directory |

## API (`app.search`)

`entries()`, `write(outDir?)`. See `types.ts`.

`write()` produces `<outDir>/<collection>/<shard>.json`, so `dist/search/en.json` with the defaults.
The ⌘K island reads it with `loadCollectionShard("/", "search", "en")`. `count` is the number of rows.

## Shard format

One plain JSON file, `SearchShard` in `types.ts`, built by `buildSearchShard` in `shard.ts`.

| Field | Type | Holds |
|---|---|---|
| `entries` | `SearchEntry[]` | The display rows below |
| `terms` | `string[]` | Sorted terms, so `src/lib/search-results.ts` finds a prefix with binary search |
| `postings` | `number[][]` | Parallel to `terms`: flat `[entryDelta, weight, entryDelta, weight, ...]`, entry indices ascending |
| `aliases` | `Record<string, string[]>` | A copy of `src/data/search-aliases.ts` |

An `entryDelta` is the distance from the entry before, the first from 0: `[1, 8, 2, 3]` is entry 1 at
weight 8 and entry 3 at weight 3. `addPosting` in `src/lib/search-results.ts` decodes it.

A term keeps every posting above weight 1 and its 60 earliest body-only postings (weight 1), in
`entries` order. So a word in more than 60 bodies finds only the first 60 of them through body text,
and a several-word query cannot match a row through a body posting that was dropped.

Budget: 150 KB gzipped on the current docs, checked by `tests/integration/build.test.ts`.

`tokenize` in `src/lib/search-tokens.ts` makes the terms and splits the query, so both sides agree:
lower case, split on anything but letters and digits, a `camelCase` word gives itself and its parts.
Tokens under 2 characters and stop words are dropped. A query that leaves no token, like `e` or
`the`, is looked up as one prefix of its raw text, so `the` finds `theme`.

## Aliases

`src/data/search-aliases.ts` maps a word visitors type to the terms the docs use: `fx` to `effects`.
An alias scores like an exact match, and the palette marks its target. A target has to be a term of
the index: a build test fails on one that is not, so a renamed page cannot silently kill an alias.

## Index rows

Order: fixed pages, packages, docs pages, demos, then sections. Each `href` appears once; the first
row wins.

| Source | Kind | `href` | `icon` |
|---|---|---|---|
| Home, Docs, Demos, About | `Page` | `/`, `/docs/`, `/demos/`, `/about/` | `page` |
| `src/data/packages.ts` (versions resolved by `src/lib/packages.ts`) | `Package` | `/docs/<id>/` | package id |
| Docs page under `/docs/concepts/` | `Concept` | page path | `concept` |
| Docs package index `/docs/<pkg>/` without a package entry | `Package` | page path | package id |
| Docs page through `plugins` / `api` / `guides` | `Plugin` / `API` / `Guide` | page path | package id |
| Any other docs page | `Page` | page path | package id |
| `src/data/demos.ts` | `Page` | `/demos/#<id>` | `demo` |
| Every h2 and h3 of a docs page | `Section` | `<page path>#<heading id>` | as its page |

A package with a data entry keeps that entry as its `Package` row; its docs index page adds no
second row, and its page text lands on that row.

## Weights

A term keeps its highest weight per row.

| Where the term is | Row | Weight |
|---|---|---|
| Title | Any row but a `Section` | 8 |
| Subtitle | Any row but a `Section` | 3 |
| Heading | `Section` | 8 |
| Text under the heading | `Section` | 1 |
| Page text before the first heading | The page's row | 1 |

The query in `src/lib/search-results.ts` multiplies the weight by what the match is worth: exact or
alias 1, the token plus `s` or `es` 0.95, a prefix `0.5 + 0.4 × token length / term length`, a typo
0.4. A row that is not a `Section` then counts 1.5 times, and a row whose whole title is the query
or an alias target, plurals folded, counts twice.

Text inside code fences is indexed, so `createApp` is found. Fence lines with their meta, directive
lines, `[!note]`, HTML comments and link targets are not. A page whose sections and headings differ
in number fails the build.

## Hooks

`build:complete` → starts writing the index into the payload's `outDir` and returns at once, so
`bun run dev` rebuilds have it too and the next plugin's hook is not held back. The kernel does not
await hook handlers, so a failure is logged as `search:write-failed` through `ctx.log.error`
instead of rejecting. `scripts/build.ts` also awaits `app.search.write()`: for the build's `outDir`
it returns the write the hook started, so the shard is written once. Every build starts a fresh
write; a failed one is not reused.

## Dependencies

`docs` (pages), `collection` (persist), `build` (visibility of `build:complete`).
