# og

Complex-tier Layer-3 plugin. Draws one 1200x630 share card per page into `public/og/`, locally, and
the cards are committed. `bun run build` and CI never draw: `publicDir` copies the files to `dist/og/`.
No events, no hooks, no state. Node only: never imported by `routes.tsx` or `spa.tsx`.

## Run it

```bash
bun run og   # scripts/og.ts: awaits app.og.write(), prints drawn, kept, removed
```

Run it after a change of card inputs: a page title or description, a package version or tagline, a
line in `src/data/og.ts`, the layout. Then commit `public/og/` and `src/data/og-manifest.json`.
`__tests__/integration/committed.test.ts` fails with "run bun run og" until you do.

## How a run decides

`src/data/og-manifest.json` maps a card file to the sha256 of what the card draws: title, meta row with
the version, line, art ids and places, and `OG_LAYOUT_VERSION`. Keys are sorted, so a small change is a
small diff.

| Card | Action |
|---|---|
| Hash in the manifest matches and the file exists | Kept |
| Hash differs, no entry, or no file | Drawn |
| PNG with no page | Deleted |

With nothing to draw, Satori, resvg, sharp and the fonts are not loaded. The manifest is written last,
so a card whose drawing failed is drawn again by the next run. **After a change to `layout.ts` or
`svg.ts`, bump `OG_LAYOUT_VERSION`:** the code is not part of the hash, the version is.

## The cards

| Row | Page | Title | Meta | Line | Object |
|---|---|---|---|---|---|
| A1 | home | Moku | none | `src/data/og.ts` | cube cluster |
| A2 | docs hub | Docs | none | `src/data/og.ts` | four package icons |
| A3 | package home | package id | name, version | tagline by the line rule | its icon |
| A4 | docs page | page title | name, version, nav group | description by the line rule | its package's icon |
| A5 | concepts page | page title | `concepts` | description by the line rule | cube cluster |
| A6 | demos | Demos | none | `src/data/og.ts` | three dioramas |
| A7 | about | About | none | `src/data/og.ts` | portrait |

The `claude` package shows its release name `moku`. Versions come from `node_modules` through
`src/lib/packages.ts`, never typed by hand.

**Line rule (`text.ts`):** a text of 56 characters or less stays whole. A longer one becomes its first
sentence, ended by `.` or `:` before a space, if that line has 20 to 56 characters; a `:` is dropped.
Otherwise it is cut at a word, or before a character the fonts do not have, and gets `…`.
`og:description` keeps the full text.

**Title:** 96 px up to 12 characters, 72 px above. A title over 44 characters widens the text column
from 600 to 930.

**Fonts:** Sora 700, Instrument Sans 400 and 500, JetBrains Mono 500, the static latin `.woff` files of
`@fontsource/*`. Satori reads no woff2, and the site's fonts are woff2 only. A character outside the
latin subset draws an empty square: `__tests__/unit/cards.test.ts` fails on it before any drawing.

## Files

| File | Job |
|---|---|
| `index.ts` | Wiring |
| `api.ts` | `cards()`, `write()` |
| `cards.ts` | Pure: pages and data to cards |
| `text.ts` | Pure: line rule, title size, column width |
| `manifest.ts` | Pure: hash, what a run does, manifest text |
| `layout.ts` | Pure: card to Satori tree, `OG_LAYOUT_VERSION` |
| `svg.ts` | Pure: floor and glow, cube cluster, logo |
| `render.ts` | Loads the libraries and fonts lazily: Satori, resvg, then sharp to a palette PNG |

Browser-safe parts outside the plugin: `src/lib/og-path.ts` (page path to card path, shared with the
head), `src/lib/page-head.ts` (the head fields `routes.tsx` uses).

## Config

| Option | Type | Default | Description |
|---|---|---|---|
| `outDir` | `string` | `"public/og"` | Folder of the PNG cards |
| `manifest` | `string` | `"src/data/og-manifest.json"` | The manifest file |

## API (`app.og`)

`cards()`, `write()`. See `types.ts`.

## Dependencies

`docs` (pages). Dev dependencies, pinned: `satori`, `@resvg/resvg-js`, `sharp`, `@fontsource/sora`,
`@fontsource/instrument-sans`, `@fontsource/jetbrains-mono`.
