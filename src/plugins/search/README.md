# search

Standard-tier Layer-3 plugin. Builds the ⌘K index from docs pages (title, description, h2 sections),
packages, demos and fixed pages, and writes it as one `collection` shard after every build.

## Config

| Option | Type | Default | Description |
|---|---|---|---|
| `collection` | `string` | `"search"` | Collection name |
| `shard` | `string` | `"en"` | Shard name |
| `outDir` | `string` | `"dist"` | Build output directory |

## API (`app.search`)

`entries()`, `write(outDir?)`. See `types.ts`.

## Hooks

`build:complete` → writes the index, so `bun run dev` rebuilds have it too. `scripts/build.ts` also
awaits `app.search.write()`, because the kernel does not await hook handlers.

## Dependencies

`docs`, `collection`, `build`.
