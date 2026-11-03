---
title: Screens
description: "Projections, screens in JSX, components and popups, scenes and animations: the screen reads committed state."
section: Guides
order: 12
---

## The screen is a projection

The screen never owns state. A projection maps the committed `player` and `session` to views; when
a commit changes the items, the views follow. Only answers go back: a button or a gesture names an
`intent`, and the gate takes it.

| Piece | Made with | What |
|---|---|---|
| Projection | `projection({ name, layer, from, key?, view, motion? })` | Committed state to views, keyed. |
| Screen | a projection whose `view` returns JSX | Laid out by Yoga, one solve per change. |
| Component | `defineComponent(name, { local?, outcomes?, view })` | A reusable piece of a screen. With `outcomes` it is a popup. |
| Scene | `defineScene(id, { bundle, layers, projections, music? })` | What is mounted together. A node names its scene. |
| Animation | `defineAnimation(id, { slots, build })` | Choreography as frozen data, played as an effect. |

## Setup

Screens are `.tsx` files. The game's `tsconfig.json` sets `"jsx": "react-jsx"` and
`"jsxImportSource": "@moku-labs/game"`. There is no DOM and no React: the runtime builds plain
description nodes, and `ui` reconciles them by identity into entities it owns.

The examples on this page start with `/** @jsxImportSource @moku-labs/game */` so they compile on
their own. In a game the tsconfig line is enough.

## Tags

| Tag | What |
|---|---|
| `screen`, `layer`, `row`, `column`, `stack`, `spacer` | Layout containers. |
| `panel` | A box that swallows taps. |
| `image` | `texture`, `fit?: "contain" \| "cover" \| "fill"`. |
| `icon` | `name`, `fit?`. |
| `text` | `content`: a string or a `Message` from `tr`. Its size comes from a text style key. |
| `button` | Names an `intent` (and a `payload`) for the gate, or writes `local` state of its component. Never both. |
| `scroll` | Children for a short list, or the windowed form `rows`, `rowHeight`, `overscan`, `row`. |
| `input` | A text field. Its text lives in the `local` field it names; Enter answers its `submit` intent. |
| `anchor` | A box over the drawn rect of a target, such as the window of a tutorial guide. |

Every tag takes `components`, a list of extra component values for the element's entity:
`<button key="claim" intent="claim" components={[Glow({ strength: 2 })]} />` glows, label
included. A `key` is what `app.ui.find`, the doors and the project index find an element by.

## A HUD and a popup

One feature file holds the HUD projection, a reward popup and the animation they share.

```tsx file="features/hud/view.tsx" group="hud" check
/** @jsxImportSource @moku-labs/game */
import type { Anim } from "@moku-labs/game";
import { Transform, mark, parallel, sequence, sfx, tween, type } from "@moku-labs/game";
import { defineAnimation, defineComponent, defineFeature, defineTextStyles, projection, tr } from "../../state";

export const hud = projection({
  name: "hud",
  layer: "ui",
  from: player => ({ coins: player.coins }), // [!note] `from` reads the committed state. One plain object is a screen drawn under the projection's name.
  view: hud => (
    <row key="bar" style={{ gap: 16, padding: { top: "safeArea.top", left: 24, right: 24 }, width: "100%", height: 120 }}>
      <text key="coins" style="hud.digits" content={tr("hud.coins", { n: hud.coins })} />
      <button key="settings" intent="openSettings" style={{ width: 96, height: 96 }}>
        <icon name="hud.gear" />
      </button>
    </row>
  )
});

export const RewardPopup = defineComponent("RewardPopup", {
  outcomes: { claim: type<{ orderId: string }>() }, // [!note] A component with `outcomes` is a popup. Its buttons answer these intents.
  view: (props: { orderId: string; gold: number }) => (
    <panel key="reward" style={{ nineSlice: "ui.panel", direction: "column", gap: 16, padding: 32, width: 600, height: 400, fit: "contain" }}>
      <text key="title" content={tr("orders.complete")} />
      <text key="gold" style="hud.digits" content={String(props.gold)} />
      <button key="claim" intent="claim" payload={{ orderId: props.orderId }} style={{ width: 240, height: 88 }}>
        <text key="claimLabel" content={tr("common.claim")} />
      </button>
    </panel>
  )
});

export const popCoins = defineAnimation("hud.popCoins", {
  slots: { coins: type<Anim.Target>() },
  build: ({ coins }) =>
    sequence(
      tween(coins, Transform, { scale: 1.2 }, { ms: 120 }),
      parallel(tween(coins, Transform, { scale: 1 }, { ms: 200, ease: "outCubic" }), sfx("hud.coins")),
      mark("done")
    )
});

export const hudFeature = defineFeature("hud", {
  projections: [hud],
  ui: [RewardPopup],
  animations: [popCoins],
  textStyles: defineTextStyles({ "hud.digits": { font: "ui.font-digits", size: 40, fill: 0xffe082, digits: true } })
});
```

A popup is an effect. The node awaits it, the gate opens for the outcomes of the component, and the
promise resolves with the answer of the button the player pressed. The animation is played the
same way.

```ts file="features/orders/deliver.ts" group="hud" check
import { play, sfx, type } from "@moku-labs/game";
import { defineNode, popup } from "../../state";
import { popCoins, RewardPopup } from "../hud/view";

export const deliver = defineNode({
  outcomes: { claimed: type<{ orderId: string }>() },
  run: async ({ player, fx, out }) => {
    fx.start(sfx("orders.complete")); // [!note] Started, not awaited: the node goes on at once.
    const answer = (await fx(popup(RewardPopup, { orderId: "o1", gold: 5 }))) as { intent: "claim"; payload: { orderId: string } };

    player.coins += 5;
    await fx(play(popCoins, { coins: { projection: "hud", key: "coins" } })); // [!note] A target is `{ projection, key }`: the view that holds the key when the timeline starts.
    return out.claimed({ orderId: answer.payload.orderId });
  }
});
```

Headless the same node runs to the end: `popup` resolves through the gate, `play` finishes at once
in fast mode, and `sfx` without `audio` resolves `undefined`.

## Words and numbers

`tr(key, params?)` returns a frozen `Message`; no locale is read at the call site. Strings live in
`strings/<locale>.json` of a feature, as ICU MessageFormat: `{n, plural, one {# order} other {#
orders}}`, `select`, `selectordinal`, `number`, `date`, `time`. `moku-game keys` compiles them into
`generated/`, and `strings: Strings` in `defineGame` makes a wrong key or a missing parameter a
compile error. A feature registers its compiled module: `strings: { en: () =>
import("../../generated/strings.en") }`.

A `text` can show a number instead of words. `bind(Counter, "value")` reads a numeric field of a
component on the same entity, and the label is written only when the shown string changes:

| Format | Shows |
|---|---|
| `int` | A whole number. |
| `mm:ss`, `h:mm:ss` | A time span. |
| `duration` | A duration. |

`Countdown({ until })` is the engine's: a game writes `until`, a `clock` moment, and the text keeps
`left`: `<text key="chestTimer" bind={bind(Countdown, "left", { format: "mm:ss" })}
components={[Countdown({ until: chest.opensAt })]} />`.

## Components and local state

`defineComponent(name, { local?, outcomes?, view(props, local) })`. A button with `local` writes
into the nearest component instance and never reaches the graph: a tab switch, a toggle. A button
with `intent` answers the gate. An `input` keeps its text in `local` and answers its `submit`
intent with `{ [local]: value }`, the only thing the gate hears.

A long `scroll` takes the windowed form: only the rows in view plus `overscan` on each side exist,
every row has the same height, and `overscan` is 5 when left out. Row state belongs in the model:
a row that leaves the window loses its local state.

## Scenes

A scene is a declaration: its bundle, its layers, its projections and its music. A rest node names
the scene it is shown on with `scene: "board"`; a node without one keeps the mounted scene.

```ts file="features/board/scene.ts" check
import { type } from "@moku-labs/game";
import { defineNode, defineScene, projection } from "../../state";

export const rolls = projection({
  name: "board.rolls",
  layer: "board",
  from: (_player, session) => ({ rolls: session.rolls }),
  view: () => []
});

export const boardScene = defineScene("board", {
  bundle: "board", // [!note] Loaded before the scene mounts. `bundles(state)` adds bundles read from the committed state.
  layers: { board: {} },
  projections: [rolls]
});

export const onBoard = defineNode({ outcomes: { roll: type() }, rest: true, scene: "board" });
```

A live switch warms the scene's bundles while the old scene still stands, builds the next one aside
and swaps it in one frame. Until the swap, the gate stays closed, so the first tap lands on a
complete scene. `app.scenes.current()` answers the mounted scene.

## Animations and motion

Animation is data. `defineAnimation(id, { slots, build })` builds a timeline from steps:
`sequence`, `parallel`, `stagger`, `tween`, `set`, `wait`, `mark`, `frames`, `sfx`, `haptic`,
`use`, `spawn`. A node plays it with `await fx(play(animation, slots))`; a flight that must not
close the gate starts with `fx.start(play(...))` and commits at once.

A projection's `motion` hooks play when a view enters, leaves or changes. A world projection plays
them for a commit; `ui` plays them for a mount too.

## Look at the screen from a test

`app.ui.tree()` answers the live screen as plain data. `app.ui.find(key)` gives the entity of a
keyed element. `app.ui.lint()` lists the tap targets under `tapTargetPt` (44 by default), the text
that overflows in some locale and the absolute elements without a `reason`. Without a mount the
renderer is inert, so `game.screen()` runs all of this in plain Bun.

:::gotchas
- **A screen never writes state.** It reads committed state and sends answers. A change goes through a node.
- **A style object changed in place is not seen.** Build a new one. An equal description costs nothing.
- **Keys are literals or props.** `tabKeys[props.tab]` is a key the project index cannot follow; the `static-keys` lint rule reports it. Pass the key in as a prop: `<TabButton id="tabSound" />`.
- **Audio is opt-in in a hand-made app.** `game.screen()` composes `audio`; an app made with `createApp` adds `audioPlugin` itself.
:::

## Related

- [ui plugin](/docs/game/plugins/ui/): the style vocabulary, popups, hot swap.
- [scenes plugin](/docs/game/plugins/scenes/): bundles, the leave look, `expect`.
- [anim plugin](/docs/game/plugins/anim/): steps, motions, `AnimPlayer`.
- [Assets](/docs/game/guides/assets/): textures, fonts and the keys the views name.
- [Hot swap](/docs/game/guides/hot-swap/): a saved view repaints the running page.
