# search

Standard-tier Layer-3 plugin. Builds the ⌘K index from docs pages (title, description, h2 sections),
packages, demos and fixed pages, and writes it as one `collection` shard after every build. No
events, no state, no lifecycle.

## Config

| Option | Type | Default | Description |
|---|---|---|---|
| `collection` | `string` | `"search"` | Collection name |
| `shard` | `string` | `"en"` | Shard name |
| `outDir` | `string` | `"dist"` | Build output directory |

## API (`app.search`)

`entries()`, `write(outDir?)`. See `types.ts`.

`write()` produces `<outDir>/<collection>/<shard>.json`, so `dist/search/en.json` with the defaults.
The ⌘K island reads it with `loadCollectionShard("/", "search", "en")`.

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
| Every h2 of a docs page | `Section` | `<page path>#<heading id>` | as its page |

A package with a data entry keeps that entry as its `Package` row; its docs index page adds no
second row.

## Hooks

`build:complete` → writes the index into the payload's `outDir`, so `bun run dev` rebuilds have it
too. The kernel does not await hook handlers, so a failure is logged as `search:write-failed` through
`ctx.log.error` instead of rejecting. `scripts/build.ts` also awaits `app.search.write()`.

## Dependencies

`docs` (pages), `collection` (persist), `build` (visibility of `build:complete`).
