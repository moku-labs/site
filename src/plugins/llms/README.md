# llms

Complex-tier Layer-3 plugin. After every build it writes the agent-facing files. No events. State
holds the write the last build started; `onInit` refuses an empty `siteUrl` at `createApp`.

## Output (relative to the output directory)

| File | Content |
|---|---|
| `docs/<pkg>/<…>/<slug>.md` | One per docs page, beside its HTML: `/docs/web/guides/routing/` → `docs/web/guides/routing.md`, `/docs/web/` → `docs/web.md` |
| `index.md`, `demos.md`, `about.md` | Landing, demos and about, generated from `src/data/*`. Empty data leaves sections out |
| `docs.md` | The docs hub (`/docs/`): the concepts pages, then the family by group, each package linked to the `.md` of its docs home (index page, else first page) |
| `llms.txt` | llmstxt.org: `# Moku Labs`, `> summary`, one `## <package name>` section of links per package in `docs.all()` order, `## Site`, `## Optional` with `llms-full.txt` |
| `llms-full.txt` | Every docs page in `docs.all()` order, each opening with `# Title` and its `Source:` line |
| `docs/<pkg>/llms.txt` | One per package, with only that package's pages |

A page `.md` is `# {title}`, `> {description}`, the body, then
`Source: {siteUrl}{path} · {npm}@{version}`. The version is read from
`node_modules/<npm>/package.json` through `src/lib/packages.ts`, only for packages that have docs
pages. Concepts pages use the installed `@moku-labs/core`. A package that is not on npm shows its
name and `manualVersion`. Site pages have no version part.

## Body conversion (`src/lib/markdown/agent-markdown.ts`)

- `:::callout{tone}` → blockquote with a bold title: the `[label]`, or Note, Warning, Tip by tone.
- `:::steps` → bullets numbered. `:::flow`, `:::gotchas` → list kept. A `[label]` becomes a bold line.
- `::diagram{name}` → `*Diagram: <caption or name>*`.
- Fences keep their language and drop their meta. `// [!note]` comments leave the code and become a
  numbered list after the block.
- Other directives lose their fence lines and keep their content.

## Config

| Option | Type | Default | Description |
|---|---|---|---|
| `siteUrl` | `string` | `""` | Absolute site URL. `createApp` throws while it is empty |
| `outDir` | `string` | `"dist"` | Default output directory of `write()` |

## API (`app.llms`)

`files()`, `write(outputDirectory?)`. See `types.ts`.

## Hooks

`build:complete` → starts the write into `payload.outDir` and returns at once, so the next
plugin's hook is not held back. The kernel does not await hooks, so a failure is logged with
`ctx.log.error("llms:write-failed", …)`. `scripts/build.ts` awaits `app.llms.write()` (D7): for
the build's `outDir` it returns the write the hook started, so the files are written once. Every
build starts a fresh write; a failed one is not reused.

## Dependencies

`docs` (pages), `build` (the `build:complete` event).
