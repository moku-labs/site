---
title: ui
description: "Screen. Screens in JSX: a projection whose view returns JSX, laid out by Yoga; components, popups and styles as data."
section: Plugins
order: 33
---

## What it does

`ui` is the interface. A screen is a projection whose `view` returns JSX. `ui` reconciles the tree
by identity into entities it owns and lays it out with one Yoga solve per change. There is no DOM
and no React: the JSX runtime builds plain description nodes.

| Set | Tier | Builds on | Emits |
|---|---|---|---|
| screen, in `screen` | Very Complex | `input`, `anim`, `text` | `ui:hot-swap`, dev only |

The game's `tsconfig.json` sets `"jsx": "react-jsx"` and `"jsxImportSource": "@moku-labs/game"`.
Screens are `.tsx` files.

**Tags.** `screen`, `layer`, `row`, `column`, `stack`, `spacer`, `panel` (swallows taps), `image`,
`icon`, `text`, `button`, `scroll`, `input` (a text field) and `anchor`. A `button` names an
`intent` for the gate or writes `local` state of its nearest component, never both. Every tag takes
`key`, `style`, `state`, `motion` and `components`: extra component values for the element's
entity, such as a filter.

**Components.** `defineComponent(name, { local?, outcomes?, view(props, local) })`. A component
with `outcomes` is a popup: `await fx(popup(Component, props))` opens the gate for its outcomes and
resolves with `{ intent, payload }` of the pressed button.

**Styles.** `defineStyle` is plain data: flow (`direction`, `gap`, `justify`, `align`), box
(`padding`, `width`, `height`, `aspect`, `overflow`), position, and visual fields. Lengths are
reference units or `"safeArea.top"` and its siblings. Variants: `is` for state (`hover`,
`pressed`, `disabled`, `active`, `selected`, `covered`) and `when` for the screen (`portrait`,
`landscape`, `tall`, `wide`). `defineTokens` names shared values. `resolve` computes a style for
given flags.

**Engine components.** `Box` (the rect of an element, its rest pose), `LocalWrite`, `ScrollState`
(`{ offset, max, moving }` of a `scroll`) and the tag `DebugTrigger` (five taps open the editor's
overlay on a page with the agent).

**Tutorial guides.** A rest node's `guide` draws a veil around a window over its targets and locks
input outside it. See [Nodes and flows](/docs/game/guides/nodes-and-flows/).

## Config

`pluginConfigs.ui`.

| Option | Type | Default | Description |
|---|---|---|---|
| `tapTargetPt` | `number` | `44` | The smallest tap target `lint()` accepts, in CSS px. |
| `breakpoints` | `{ tall: number; wide: number }` | `{ tall: 2, wide: 1.5 }` | Aspect thresholds of the `when` style variants. |
| `focusRing` | `FocusRing` | engine default | The ring around the control the keyboard focused. A game that sets it gives all fields. |
| `textInput` | `TextInputLook` | engine default | The caret, selection and IME underline of a text field. A game that sets it gives all fields. |

## API

Mounted at `app.ui`, reachable with `ctx.require(uiPlugin)`.

| Method | Signature | Description |
|---|---|---|
| `tree` | `() => UiNode` | The live screen as plain data: every element with its rect, resolved style and state flags. A text node carries the words it draws. |
| `find` | `(key: string) => World.Entity \| undefined` | The entity of a keyed element, so a test can tap it. |
| `lint` | `() => readonly Finding[]` | Tap targets under `tapTargetPt`, text that overflows in some locale, absolute elements without a `reason`. |
| `fill` | `(key: string, value: string) => boolean` | Types into the text field with that key. |
| `scroll` | `(key: string, to: number) => boolean` | Puts a `scroll` at an offset at once. |
| `rectOf` | `(target: AnchorTarget \| readonly AnchorTarget[]) => { x; y; w; h } \| undefined` | Where a target is drawn, in screen reference units. |

## Events

### Emits

| Event | Payload | When |
|---|---|---|
| `ui:hot-swap` | `{ file: string; module: Readonly<Record<string, unknown>> }` | Dev only, global: a saved view module was swapped. `effects` and `assets` hook it. |

### Listens to

None that a game sees.

## Example

```tsx file="features/hud/view.tsx" check
/** @jsxImportSource @moku-labs/game */
import { createApp, defineComponent, defineFeature, defineGame, screen, tr, type } from "@moku-labs/game";

const { defineNode, popup, projection } = defineGame<{
  player: { coins: number };
  session: { rolls: number };
  assets: string;
  strings: Record<string, unknown>;
}>();

// The HUD: a projection whose view returns JSX.
export const hud = projection({
  name: "hud",
  layer: "ui",
  from: player => ({ coins: player.coins }),
  view: hud => (
    <row key="bar" style={{ gap: 16, padding: { top: "safeArea.top", left: 24, right: 24 }, width: "100%", height: 120 }}>
      <text key="coins" content={tr("hud.coins", { n: hud.coins })} />
      <button key="settings" intent="openSettings" style={{ width: 96, height: 96 }}>
        <icon name="hud.gear" />
      </button>
    </row>
  )
});

// A component with outcomes is a popup.
export const RewardPopup = defineComponent("RewardPopup", {
  outcomes: { claim: type<{ orderId: string }>() },
  view: (props: { orderId: string; gold: number }) => (
    <panel key="reward" style={{ direction: "column", gap: 16, padding: 32, width: 600, height: 400 }}>
      <text key="gold" content={String(props.gold)} />
      <button key="claim" intent="claim" payload={{ orderId: props.orderId }} style={{ width: 240, height: 88 }}>
        <text content={tr("common.claim")} />
      </button>
    </panel>
  )
});

// The node awaits the popup: the gate opens for its outcomes.
export const deliver = defineNode({
  outcomes: { claimed: type() },
  run: async ({ player, fx, out }) => {
    const answer = await fx(popup(RewardPopup, { orderId: "o1", gold: 5 }));
    if (answer.intent === "claim") player.coins += 5;
    return out.claimed();
  }
});

const app = createApp({ plugins: [...screen, defineFeature("hud", { projections: [hud], ui: [RewardPopup] })] });
app.ui.find("claim");
app.ui.lint();
```

:::gotchas
- **A style changed in place is not seen.** Build a new object. Inline styles are fine: `ui` compares by value.
- **Keys are literals.** The [lint rule](/docs/game/guides/lint/) `static-keys` refuses computed keys, so the project index can follow them.
- **Row state belongs in the model.** A row that leaves a windowed `scroll` loses its local state.
- **Look an element up again after a restore.** Scroll offsets, local state, hover and focus start anew.
:::

## Related

- [Screens](/docs/game/guides/screens/): JSX, scenes and the full tag reference.
- [text](/docs/game/plugins/text/): text styles and labels.
- [anim](/docs/game/plugins/anim/): the `motion` prop.
