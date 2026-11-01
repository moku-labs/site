# llms

Standard-tier Layer-3 plugin. After every build it writes the agent-facing files. No events, no
state, no lifecycle.

## Output (relative to the output directory)

| File | Content |
|---|---|
| `docs/<pkg>/<…>/<slug>.md` | One per docs page, beside its HTML: `/docs/web/guides/routing/` → `docs/web/guides/routing.md`, `/docs/web/` → `docs/web.md` |
| `index.md`, `demos.md`, `about.md` | Landing, demos and about, generated from `src/data/*`. Empty data leaves sections out |
| `llms.txt` | llmstxt.org: `# Moku Labs`, `> summary`, one `## <package name>` section of links per package in `docs.all()` order, `## Site`, `## Optional` with `llms-full.txt` |
| `llms-full.txt` | Every docs page in `docs.all()` order, each opening with `# Title` and its `Source:` line |
| `docs/<pkg>/llms.txt` | One per package, with only that package's pages |

A page `.md` is `# {title}`, `> {description}`, the body, then
`Source: {siteUrl}{path} · {npm}@{version}`. The version is read from
`node_modules/<npm>/package.json` through `src/lib/packages.ts`, only for packages that have docs
pages. Concepts pages use the installed `@moku-labs/core`. A package that is not on npm shows its
name and `manualVersion`. Site pages have no version part.

## Body conversion (`markdown.ts`)

- `:::callout{tone}` → blockquote with a bold title: the `[label]`, or Note, Warning, Tip by tone.
- `:::steps` → bullets numbered. `:::flow`, `:::gotchas` → list kept. A `[label]` becomes a bold line.
- `::diagram{name}` → `*Diagram: <caption or name>*`.
- Fences keep their language and drop their meta. `// [!note]` comments leave the code and become a
  numbered list after the block.
- Other directives lose their fence lines and keep their content.

## Config

| Option | Type | Default | Description |
|---|---|---|---|
| `siteUrl` | `string` | `""` | Absolute site URL. `files()` and `emit()` throw while it is empty |
| `outDir` | `string` | `"dist"` | Default output directory of `emit()` |

## API (`app.llms`)

`files()`, `emit(outputDirectory?)`. See `types.ts`.

## Hooks

`build:complete` → `emit(payload.outDir)` for the dev loop. The kernel does not await hooks, so a
failure is logged with `ctx.log.error("llms:emit", …)`. `scripts/build.ts` awaits
`app.llms.emit()` (D7).

## Dependencies

`docs` (pages), `build` (the `build:complete` event).
