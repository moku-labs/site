# llms

Standard-tier Layer-3 plugin. After every build it writes the agent-facing files:

- one `.md` beside every docs page (`/docs/web/guides/routing.md`), plus landing, demos and about;
- `/llms.txt` (llmstxt.org format), `/llms-full.txt` (all docs in nav order);
- `/docs/<pkg>/llms.txt` per package.

## Config

| Option | Type | Default | Description |
|---|---|---|---|
| `siteUrl` | `string` | `""` | Absolute site URL. `emit()` throws while it is empty |
| `outDir` | `string` | `"dist"` | Build output directory |

## API (`app.llms`)

`files()`, `emit(outDir?)`. See `types.ts`.

## Hooks

`build:complete` → writes the files for the dev loop. `scripts/build.ts` awaits `app.llms.emit()`.

## Dependencies

`docs`, `build`.
