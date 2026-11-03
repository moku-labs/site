---
title: buildfile
description: "The *.moku.yaml front end: one zod schema gives the BuildSpec, the types and the editor's JSON Schema."
section: Pipeline
order: 11
---

## What it does

`buildfile` parses and validates build files. The runner, `compose` and the CLI all go through it.
The types, the runtime check and the editor schema come from one zod schema, so they cannot differ.

It does not consult the registry. A provider that does not exist is found by the runner, so
`moku validate` works offline.

## Build file format

```yaml file="launch.moku.yaml"
# yaml-language-server: $schema=.moku/build.schema.json
$schema: .moku/build.schema.json
version: 1
name: launch-assets
defaults:
  provider: elevenlabs
  maxAttempts: 3
items:
  - id: intro-line
    task: voiceover
    input:
      text: "Hello, world!"
      voice: "21m00Tcm4TlvDq8ikWAM"
  - task: translate
    provider: openai
    input:
      text: "Hello, world!"
      targetLang: es
itemsFrom: extra-items.ndjson
```

| Field | Type | Required | Description |
|---|---|---|---|
| `version` | `1` | yes | Only `1` is accepted. |
| `name` | `string` | yes | The build name, and the export folder. |
| `defaults` | `{ provider?, maxAttempts? }` | no | Applied by the runner. |
| `items` | `BuildItem[]` | yes | May be empty. |
| `itemsFrom` | `string` | no | An NDJSON file of items, one JSON object per line. Relative to the build file. Appended to `items`. |

Unknown top-level keys are stripped, not refused. That is why `$schema:` is safe. Only the modeline
comment turns on editor autocomplete.

| `BuildItem` field | Type | Required | Description |
|---|---|---|---|
| `task` | `string` | yes | A registered task. The runner checks it. |
| `id` | `string` | no | Export file name and `$ref` target. Unique in the file. Not part of the keys. |
| `provider` | `string` | no | Overrides `defaults.provider`. |
| `input` | `Record<string, unknown>` | yes | The task's request. May hold references. |
| `params` | `Record<string, unknown>` | no | Provider settings that change the output. Next to `input`, never inside it. |
| `pack` | `{ name, version }` | no | Asset pack association. The version is part of the artifact key. |

`input.params` is refused, because the runner would drop it silently.

## References

Any value inside `input` may be a reference, nested ones too.

| Value | Means |
|---|---|
| `{ $ref: "<item id>" }` | The artifact of another item in the same file. It runs first. |
| `{ $file: "<path>" }` | A local file, relative to the build file. Its content hash enters the keys. |

The handler receives both as `{ path, mimeType, hash }`. `compile` refuses a duplicate `id`, an
unknown `$ref`, a cycle and an empty reference. A missing `$file` is reported when the runner plans.

## Nine-slice hints

An `id` may end with `{nine=l,t,r,b}`, four whole-pixel insets. The hint stays in the exported file
name, where the game engine reads it. Any other brace in an `id` is refused.

## Config

`pluginConfigs.buildfile`.

| Option | Type | Default | Description |
|---|---|---|---|
| `defaultGlob` | `string` | `"**/*.moku.yaml"` | Used when no pattern is given. |
| `schemaPath` | `string` | `".moku/build.schema.json"` | Where `moku new` writes the JSON Schema. |

## API

Mounted at `app.buildfile`, reachable with `ctx.require(buildfilePlugin)`.

| Method | Signature | Description |
|---|---|---|
| `compile` | `(source: BuildfileSource) => Promise<CompiledBuild>` | One source to `{ file, spec }`. |
| `loadGlob` | `(pattern?: string) => Promise<CompiledBuild[]>` | Compiles every match, in sorted path order. Throws when nothing matches. |
| `jsonSchema` | `() => Record<string, unknown>` | The JSON Schema of the format. |
| `template` | `(opts: { name: string }) => string` | The starter text of `moku new`. |

`BuildfileSource` is `{ path }` or `{ text, lang: "yaml" }`. A `.ts` path is imported, and its
default export must come from `defineBuild`. Any other path is read as YAML.

A failure is two lines: `[ai] Build file "<label>" is invalid.`, then the dotted path and the message.

## A build file in TypeScript

`defineBuild` validates through the same schema and returns the spec.

```ts file="demo.moku.ts" check
import { defineBuild } from "@moku-labs/ai";

export default defineBuild({
  version: 1,
  name: "demo",
  items: [{ task: "voiceover", input: { text: "Hello, world!", voice: "21m00Tcm4TlvDq8ikWAM" } }]
});
```

```ts file="load.ts" check
import { app } from "./app";

const { spec } = await app.buildfile.compile({ path: "demo.moku.ts" });
console.log(spec.items.length);
```

## Events

### Emits

None.

### Listens to

None.

## Depends on

Nothing.
