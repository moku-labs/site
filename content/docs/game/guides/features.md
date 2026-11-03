---
title: Features
description: "defineFeature: a plugin that adds nodes, flows, views and strings to the graph, with sub-features and slots."
section: Guides
order: 11
---

## What a feature is

`defineFeature(name, description)` makes an ordinary plugin. In `onInit` it registers into
`flow.features`: its flows, its contributions to slots, and, with a screen, its projections,
components, scenes, animations, strings and styles. `feature.logicOnly` is the same plugin with the
logic keys only, for headless tests.

A game lists its features in `index.ts`. `game.screen()` composes them after `shared`;
`game.headless()` composes the `logicOnly` of each.

| Key | Read by | What |
|---|---|---|
| `nodes` | `flow` | Nodes the feature owns. |
| `flows` | `flow` | Flows the feature owns. |
| `contribute` | `flow` | Sub-flows for slots: `{ [slotName]: { flow, order, when? } }`. |
| `features` | the shell | The sub-features of this feature. |
| `projections`, `systems`, `components` | `world` | Views from committed state, ECS systems and components. |
| `scenes` | `scenes` | `defineScene` results. |
| `assets` | `assets` | The bundles of the feature. |
| `animations` | `anim` | `defineAnimation` results. |
| `ui` | `ui` | `defineComponent` results. |
| `strings` | `i18n` | Compiled messages per locale, or a loader per locale. |
| `textStyles`, `textFormats` | `text` | `defineTextStyles` and `defineTextFormats` results. |
| `emitters`, `filters` | `effects` | `defineEmitter` and `defineFilter` results. |

## Fill a slot

A slot is an extension point in a flow. Features contribute sub-flows to it, and they run in
`order`. `contribution(slot, { flow, order, when? })` builds the `contribute` entry and checks at
compile time that every outcome of the flow is `done` or an outcome the slot declares.

```ts file="flows/main.ts" group="thanks" check
import { slot, type } from "@moku-labs/game";
import { defineFlow, defineNode } from "../state";

export const afterRoll = slot("afterRoll"); // [!note] A slot without declared outcomes ends with `done`.

const lobby = defineNode({ outcomes: { roll: type() }, rest: true, checkpoint: true });

export const mainFlow = defineFlow("main", {
  nodes: { lobby, afterRoll },
  start: "lobby",
  edges: { lobby: { roll: "afterRoll" }, afterRoll: { done: "lobby" } }
});
```

```ts file="features/thanks/index.ts" group="thanks" check
import { contribution, exit, type } from "@moku-labs/game";
import { afterRoll } from "../../flows/main";
import { defineFeature, defineFlow, defineNode } from "../../state";

const thanks = defineNode({ outcomes: { ok: type() }, rest: true, over: true });

const thanksFlow = defineFlow("thanksPopup", {
  nodes: { thanks },
  start: "thanks",
  outcomes: { done: type() },
  edges: { thanks: { ok: exit("done") } } // [!note] Exiting `done` hands over to the next contribution, then the slot's own `done` edge.
});

export const thanksFeature = defineFeature("thanks", { // [!note] A feature name differs from every flow id and every plugin name.
  flows: [thanksFlow],
  contribute: { ...contribution(afterRoll, { flow: thanksFlow, order: 10 }) }
});
```

- `when(snapshot)` skips a contribution. It reads the committed state, also what an earlier
  contribution of the same slot wrote.
- Two contributions of one slot need different `order` values.
- A contribution that exits an outcome the slot declares leaves the slot at once with its payload.
  The later contributions do not run, and the slot takes its own edge of that outcome.
- The next entry of a slot starts at its first contribution.

## Sub-features

A feature may hold sub-features, each in a folder of its own inside the parent's:

```text
features/
  episodes/
    index.ts          the door: defineFeature("episodes", { features: [...] })
    episodes-kit/     what the episodes share
    ep01/             one episode: index.ts, assets/, strings/
```

```ts file="features/episodes/episodes-kit/index.ts" group="episodes" check
import { defineFeature } from "../../../state";

export const episodesKitFeature = defineFeature("episodes-kit", {}); // [!note] The door registers a feature named like its folder.
```

```ts file="features/episodes/ep01/index.ts" group="episodes" check
import { exit, type } from "@moku-labs/game";
import { defineFeature, defineFlow, defineNode } from "../../../state";

const intro = defineNode({ outcomes: { next: type() }, rest: true });

const storyFlow = defineFlow("ep01Story", {
  nodes: { intro },
  start: "intro",
  outcomes: { done: type() },
  edges: { intro: { next: exit("done") } }
});

export const ep01Feature = defineFeature("ep01", {
  flows: [storyFlow],
  contribute: { episodeStep: { flow: storyFlow, order: 10 } }
});
```

```ts file="features/episodes/index.ts" group="episodes" check
import { defineFeature } from "../../state";
import { ep01Feature } from "./ep01";
import { episodesKitFeature } from "./episodes-kit";

export const episodesFeature = defineFeature("episodes", {
  features: [episodesKitFeature, ep01Feature] // [!note] The parent lists every sub-feature it imports from `./<folder>`.
});
```

A game lists the parent only: `features: [homeFeature, episodesFeature]`. The shell composes the
tree depth first, a parent before its children: `home`, `episodes`, `episodes-kit`, `ep01`. An app
made by hand flattens it with `flattenFeatures([homeFeature, episodesFeature])`. A parent's
`onInit` throws when a declared sub-feature is not composed.

- A sub-feature never imports the feature it lives in. Move what they share into a sibling, such
  as `episodes-kit`, and import it from its door.
- A sub-feature with assets gets its own bundles, named like its folder. Its asset keys and string
  keys start with its name: `features/episodes/ep01/assets/ward/room.png` is `ep01.ward.room`.
- `headless: { features: [ep01Feature] }` may name a sub-feature alone.
- `app.flow.features.all()` answers `{ name, description, parent? }` per feature.

## Names

A feature and a flow share one namespace. Name the feature `boardScreen` when its flow is `board`.
A feature name is also never a plugin name: `time`, `lifecycle`, `model`, `clock`, `flow`,
`world`, `renderer`, `input`, `assets`, `scenes`, `anim`, `i18n`, `text`, `ui`, `effects`, `audio`,
`platform`, `log`, `env`. `defineFeature` refuses every engine plugin name, and `run()` checks the
list.

## Game plugins

A feature adds to the graph. A game plugin answers effects, listens to events and owns resources.
It is `createPlugin` from `@moku-labs/game`, listed in `defineGameApp({ plugins })`; its API lands
on `screen().app`.

`defineEffect` declares an effect once, typed. The plugin that owns it registers the one handler:

```ts file="plugins/view-env.ts" check
import { createPlugin, defineEffect, flowPlugin } from "@moku-labs/game";

export const envRead = defineEffect<{ notice: boolean }, { reducedMotion: boolean }>("view-env.read", {
  fast: "run" // [!note] The handler also runs in a fast walk, so `await fx(envRead(...))` resolves the result headless too.
});

export const viewEnvPlugin = createPlugin("viewEnv", {
  depends: [flowPlugin],
  onStart: ctx => {
    envRead.handle(ctx.require(flowPlugin).fx, () => ({
      reducedMotion: globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false // [!note] Plain Bun has no `matchMedia`: the headless answer is `false`.
    }));
  }
});
```

A node then reads it with `const env = await fx(envRead({ notice: true }))`, typed. Only
`{ fast: "run" }` without `cosmetic` resolves the result; any other declaration resolves
`Result | undefined`.

- **Events.** `hooks: ctx => ({ "flow:edge": payload => { ... } })` with `depends: [flowPlugin]`.
  A hook that throws never stops the game: the engine writes `"game: a hook failed"` to the log.
- **Resources.** A plugin that owns a resource stores it in its state and frees it in
  `onStop: ({ state }) => …`. A throwing `onStop` makes `app.stop()` reject.
- **The exit.** A Leave button's plugin calls `ctx.require(platformPlugin).exit()` itself.

:::gotchas
- **List the parent, not the children.** A sub-feature listed by the game and by its parent throws: `[game] defineGameApp: the feature "ep01" is listed twice: …`.
- **`shared` has no sub-features.** `[game] defineGameApp: shared declares sub-features.`
- **A list entry must come from `defineFeature`.** Otherwise `[game] defineGameApp: features[2] is not a feature.`
- **The headless app composes `logicOnly`.** Projections, scenes and styles of a feature never reach `game.headless()`.
:::

## Related

- [Nodes & flows](/docs/game/guides/nodes-and-flows/): slots with declared outcomes.
- [Testing](/docs/game/guides/testing/): `isolate` plays one feature without the rest of the game.
- [Lint](/docs/game/guides/lint/): `feature-door` and `sub-features`.
- [flow plugin](/docs/game/plugins/flow/): `features.register`, `features.all`, `features.contributions`.
