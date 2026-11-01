# docs

Standard-tier Layer-3 plugin. Reads the docs Markdown under `content/docs/`, builds the sidebar,
renders HTML through the content plugin's renderer, and keeps the raw Markdown for the `.md` and
`llms.txt` output.

## Config

| Option | Type | Default | Description |
|---|---|---|---|
| `dir` | `string` | `"content/docs"` | Root of the docs Markdown |

## API (`app.docs`)

`all()`, `get(path)`, `byPackage(pkg)`, `nav(pkg)`, `neighbours(path)`, `params(depth)`. See `types.ts`.

## Content rules

- `<pkg>/index.md` → `/docs/<pkg>/`, `<pkg>/<page>.md` → `/docs/<pkg>/<page>/`,
  `<pkg>/<section>/<page>.md` → `/docs/<pkg>/<section>/<page>/`. Deeper files fail the build.
- `<pkg>` is a package id from `src/data/packages.ts` or `concepts`.
- Frontmatter: `title` and `description` required; `order`, `section`, `drift`, `full` optional.

## Dependencies

`content` (for `renderMarkdown`).
