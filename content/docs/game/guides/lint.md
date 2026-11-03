---
title: Lint
description: "@moku-labs/game/lint: the oxlint rules that keep a game deterministic, lazy, and on its layered layout."
section: Guides
order: 19
---

## Setup

`@moku-labs/game/lint` is an oxlint JS plugin named `moku-game`. The rules use the ESLint rule API,
so ESLint loads the same object. The engine ships no default severity: a game turns each rule on.

```json file=".oxlintrc.json"
{
  "jsPlugins": ["@moku-labs/game/lint"],
  "rules": {
    "moku-game/lazy-imports": "error",
    "moku-game/native-imports": "error",
    "moku-game/dev-imports": "error",
    "moku-game/no-module-state": "error",
    "moku-game/determinism": "error",
    "moku-game/rules-siblings": "error",
    "moku-game/static-keys": "error",
    "moku-game/layer-imports": "error",
    "moku-game/feature-door": "error",
    "moku-game/sub-features": "error",
    "moku-game/test-suffix": "error"
  }
}
```

## The engine rules

| Rule | Reports | Passes |
|---|---|---|
| `lazy-imports` | A static value import of `pixi.js` or `yoga-layout`, subpaths too. | `import type …`, `await import("pixi.js")`. |
| `native-imports` | `@moku-labs/system`, `@moku-labs/native`, `@tauri-apps/*` in the logic, the root `index.ts`, `config.ts`, `kit.ts` and `plugins/`. | Name the capability in `config.ts` `system`; the engine page wires it. |
| `dev-imports` | `@moku-labs/editor` and `@moku-labs/game/control` outside dev files. | The same import in `*.dev.ts(x)`, a test or the generated `.moku/` page. |
| `no-module-state` | A module-scope `let` or `var`, a module-scope `new Map/Set/WeakMap/WeakSet`. | The same inside a function. |
| `determinism` | `Math.random`, `Date.now`, `performance.now`, `new Date()`, `setTimeout`, `setInterval` in the logic. | `new Date(now)`: it formats a stored moment. Plugin folders are the effect side and are skipped. |
| `rules-siblings` | An import in `rules/` that is not a `./` sibling, `@core/types` or `@shared/rules`. | `import { cost } from "./cost"`. |
| `static-keys` | A JSX `key` the project index cannot follow. | A literal, a template, `props.id`, `props.<name>Key`, a call. |

`import { type A } from "pixi.js"` is reported: under `verbatimModuleSyntax` it keeps a
side-effect import, which loads Pixi. Write `import type { A } from "pixi.js"`.

## Static keys

The game reports a JSX key at run time, and the [project index](/docs/game/api/) turns it back
into the line that wrote it. That works when the key is written so the index can read it.

```tsx file="views/tab-reported.tsx" check
/** @jsxImportSource @moku-labs/game */
type Tab = "audio" | "language";

const tabKeys = { audio: "tabSound", language: "tabLanguage" };

export function TabButton(props: { tab: Tab }) {
  const key = tabKeys[props.tab]; // [!note] Reported: the key is picked out of a table at run time.
  return <button key={key} intent="openTab" />;
}
```

```tsx file="views/tab-passes.tsx" check
/** @jsxImportSource @moku-labs/game */
type Tab = "audio" | "language";

export function TabButton(props: { id: string; tab: Tab }) {
  return <button key={props.id} intent="openTab" payload={{ tab: props.tab }} />; // [!note] Passes: the key comes in as a key-carrying prop, `id` or a name that ends in `Key`.
}

export const soundTab = <TabButton id="tabSound" tab="audio" />;
```

The message is `Keys: a JSX key must be a literal, a template, or props.id / props.<name>Key. Pass
the key in as a prop: <X id="…">.`

## The layout rules

Four rules check a game on the layered layout. Each path below the game root sits in one layer:

| Path | Layer |
|---|---|
| `core/**` | core |
| `shared/**` | shared |
| `features/<f>/**`, `features/<f>/<sub>/**` | features |
| `plugins/<p>/**` | plugins |
| `generated/**` | generated |
| `game.ts` | game |
| `tests/**` | tests |

A file outside them, such as `kit.ts`, `nodes/` or `web/`, keeps the layout rules quiet. So a game
on a flat layout lints as before.

| Rule | Says |
|---|---|
| `layer-imports` | The order is core ← shared ← features ← `game.ts`; plugins import core and shared; every layer may import `generated/`. `import type` counts too. |
| `feature-door` | Another feature is imported only through its `index.ts`, `@features/orders`. Only `game.ts` imports the `@features` and `@plugins` barrels. A relative import that leaves a feature is written as an alias. |
| `sub-features` | A feature's door imports every sub-feature from `./<folder>` and lists it in `features: [...]`. A sub-feature's door registers a feature named like its folder. |
| `test-suffix` | A file in a test kind folder ends with its suffix: `tests/e2e/` `.e2e.ts`, `__tests__/isolated/` `.isolated.ts`, and so on. See [Testing](/docs/game/guides/testing/). |

A sub-feature never imports the feature it lives in: `Door: a sub-feature does not import the
feature it lives in: features/episodes/ep01 imports features/episodes. Move what they share into a
sibling sub-feature, such as features/episodes/episodes-kit, and import it from its door.`

## Aliases

`layer-imports`, `feature-door` and `rules-siblings` read the `compilerOptions.paths` of the game's
`tsconfig.json`, the way the project index does, `extends` included. Without `paths` they read the
default table:

| Alias | Target |
|---|---|
| `@core/*` | `core/*` |
| `@shared` | `shared/index.ts` |
| `@shared/rules` | `shared/rules/index.ts` |
| `@features` | `features/index.ts` |
| `@features/*` | `features/*/index.ts` |
| `@plugins` | `plugins/index.ts` |
| `@generated/*` | `generated/*` |
| `@tests/*` | `tests/*` |

`aliasTargetsOf(tsconfig, root, specifier)` answers what the rules read for one specifier:

```ts file="alias.ts" check
import { aliasTargetsOf } from "@moku-labs/game/lint";

aliasTargetsOf("/game/tsconfig.json", "/game", "@features/orders"); // ["/game/features/orders/index.ts"] for a game without a tsconfig
```

The `*` of `@features/*` crosses `/`: `@features/episodes/ep01` is the door of a sub-feature.

## Options

Every rule takes `files` and `ignores`. A key you give replaces that default. Globs are relative to
the directory oxlint runs in.

```json file=".oxlintrc.json"
{
  "rules": {
    "moku-game/determinism": ["error", { "files": ["src/logic/**"], "ignores": ["**/*.dev.ts"] }],
    "moku-game/layer-imports": ["error", { "root": "src", "tsconfig": "tsconfig.game.json" }],
    "moku-game/test-suffix": ["error", { "suffixes": { "tests/e2e/": ".spec.ts" } }]
  }
}
```

| Option | Rules | Meaning |
|---|---|---|
| `files`, `ignores` | every rule | Globs of the files the rule checks or skips. |
| `root` | the layout rules, `rules-siblings`, `test-suffix` | The folder of `core/`, `shared/`, `features/`, `plugins/` and `game.ts`. Default `.`. |
| `tsconfig` | `layer-imports`, `feature-door`, `sub-features`, `rules-siblings` | The tsconfig whose `paths` name the aliases. Default `tsconfig.json`. |
| `suffixes` | `test-suffix` | Kind folder to suffix. Replaces the default table whole. |

The logic, where `determinism` and `native-imports` look by default, is the root `index.ts`,
`**/state.ts`, `**/tables.ts`, `**/game.ts` and `**/{core,nodes,flows,rules,features,shared}/**`.
Tests (`tests/**`, `**/__tests__/**`, `*.test.ts`) are skipped by every rule but `test-suffix`.

:::gotchas
- **Turn each rule on.** The plugin ships no default severity.
- **A lazy `import("pixi.js")` is fine.** oxlint's own `no-restricted-imports` would flag it, which is why these rules ship as plugin code.
- **Plugins answer effects.** `determinism` skips plugin folders: a plugin answers `schedule` with a timer by design.
:::

## Related

- [Nodes & flows](/docs/game/guides/nodes-and-flows/): the rules of determinism the lint enforces.
- [Features](/docs/game/guides/features/): doors and sub-features.
- [API reference](/docs/game/api/): `@moku-labs/game/lint` and `@moku-labs/game/project`.
