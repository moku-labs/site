# docs

Standard-tier Layer-3 plugin. Reads the docs Markdown under `content/docs/`, builds the sidebar,
renders HTML through the content plugin's renderer, and keeps the raw Markdown for the `.md` and
`llms.txt` output. Pages load once, lazily, on the first API call. No events, no lifecycle.

## Config

| Option | Type | Default | Description |
|---|---|---|---|
| `dir` | `string` | `"content/docs"` | Root of the docs Markdown, relative to the working directory |

## API (`app.docs`)

`all()`, `get(path)`, `byPackage(pkg)`, `nav(pkg)`, `neighbours(path)`, `params(depth)`. See `types.ts`.

## Content rules

- `<pkg>/index.md` → `/docs/<pkg>/`, `<pkg>/<page>.md` → `/docs/<pkg>/<page>/`,
  `<pkg>/<section>/<page>.md` → `/docs/<pkg>/<section>/<page>/`. Deeper files fail the build.
- `<pkg>` is a package id from `src/data/packages.ts` or `concepts`. Anything else fails the build.
- Package order: `concepts` first, then the family in data order.
- Frontmatter: `title` and `description` required; `order` (number, default 0), `section` (nav
  group label), `drift` (string), `full` (`true`/`false`) optional. A page without `section` goes
  to `Concepts` (concepts) or `Get started` (a package).
- Sort: package, then group (where its first page falls by `order`), then `order`, then title.
- Prev/next stay in the package; at its ends they link to the nearest package with pages: its
  index page, or its first page when it has no index.
- `<!-- kernel-errors -->` in a body is replaced by the list from `src/lib/kernel-errors.ts`
  before rendering. The capture runs only when a page has the marker.
- TOC: h2/h3 outside fenced code. Ids use the same slug as `headingSlug` in
  `src/lib/markdown/heading-ids.ts` (`markdown.ts` keeps a local copy until both are unified).

## Dependencies

`content` (for `renderMarkdown`).
