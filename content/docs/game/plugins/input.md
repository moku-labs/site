---
title: input
description: "Screen. Gestures as data: tap, press, drag, swipe and trace are components on a view; the answer reaches the flow gate."
section: Plugins
order: 27
---

## What it does

`input` turns pointer events into answers for the [flow](/docs/game/plugins/flow/) gate. A view
says what it does with data components; the engine owns the drag, the hit test and the way home.

| Set | Tier | Builds on | Emits |
|---|---|---|---|
| screen, in `screen` | Standard | `flow`, `world`, `renderer` | nothing |

| Component | What it does |
|---|---|
| `Tappable` | A tap answers its `intent` with its `payload`. |
| `Pressable` | A long press answers its intent. |
| `Draggable` | `{ payload, carry?, aim? }`: the view can be picked up. `aim` moves the hover and drop lookup to a point of the view. |
| `DropTarget` | Names the intent a drop on it answers, with both payloads merged. |
| `Swipeable` | A swipe answers its intent, with the direction in the payload. |
| `Traceable` | Makes the view a cell of a trace: a finger drawn through cells answers one path. |
| `Touchable` | A tag: the view reaches the tap listeners and answers nothing. |

The engine marks state with tags and one resource: `Held`, `Hovered`, `PointerOver` (an idle
mouse or pen is over the view, the `hover` style state), `Pressed`, `Traced`, and `Pointer`.

One pointer is followed. A finger that has not started a gesture gives way to the next finger
that goes down. A finger that started one keeps it.

## Config

`pluginConfigs.input`.

| Option | Type | Default | Description |
|---|---|---|---|
| `tapSlopPx` | `number` | `12` | Largest move, in reference px, that still counts as a tap or a long press. |
| `longPressMs` | `number` | `450` | Hold time, in ms of `time`, after which a `Pressable` answers. |
| `dragStartPx` | `number` | `8` | Move that turns a press on a `Draggable` into a drag. |
| `swipeMinPx` | `number` | `48` | Shortest swipe. |
| `swipeMaxMs` | `number` | `300` | Longest swipe, from pointer down to pointer up. |
| `heldScale` | `number` | engine default | How much bigger the view in the hand is drawn. |
| `cursor` | `{ control: string; idle: string }` | `{ control: "pointer", idle: "" }` | CSS cursors over a control and elsewhere. |
| `traceStepPx` | `number` | `32` | Reference px between two hit tests along a trace. Keep it below the shortest cell span. |
| `traceInset` | `number` | `0.4` | Radius of a trace cell's hit circle, times the short side of its hit box. |

## API

Mounted at `app.input`, reachable with `ctx.require(inputPlugin)`. A target is an entity or
`{ projection, key }`.

| Method | Signature | Description |
|---|---|---|
| `tap` | `(target) => boolean` | Reads the `Tappable` of a view and answers its intent. |
| `press` | `(target) => boolean` | The same for a `Pressable`, as a long press would. |
| `drag` | `(from, to) => boolean` | Answers the destination's intent with both payloads merged. The destination wins a key both carry. |
| `swipe` | `(target, direction: "up" \| "down" \| "left" \| "right") => boolean` | Answers the `Swipeable` intent with the direction. |
| `trace` | `(path: readonly Target[]) => boolean` | Answers one path through cells that all name the same intent. |
| `onTap`, `onPointer`, `onKey` | `(fn) => () => void` | Listeners. `onPointer` runs inside the DOM listener, the one place a call that needs the user gesture can run. |
| `pressKey` | `(key: string, options?: { shift?: boolean }) => boolean` | Presses a key without a keyboard. |
| `cursor` | `() => string` | The CSS cursor set on the canvas now. |
| `listeners` | `() => number` | Registered listeners and controls. A leak check reads it. |
| `lock.window` | `(rect \| null \| undefined) => void` | The input lock of a tutorial guide. `null` locks everything, `undefined` lifts it. |
| `controls.add` | `(Component) => () => void` | Another component that makes a view a control, for the cursor. |

`tap`, `press`, `drag`, `swipe` and `trace` do no hit test and are never locked: they are the
doors a test or an agent uses.

## Events

### Emits

None. A gesture ends as an answer to `flow.gate`.

### Listens to

None.

## Example

```ts file="board.ts" check
import { createApp, Draggable, DropTarget, defineFeature, projection, screen } from "@moku-labs/game";

type Item = { id: string; cell: string };

// A view declares its behaviour; the engine owns the drag and the way home.
const boardItems = projection({
  name: "board.items",
  layer: "items",
  from: (player: { items: Item[] }) => player.items,
  key: item => item.id,
  view: item => [
    Draggable({ payload: { from: item.cell } }),
    DropTarget({ intent: "merge", payload: { to: item.cell } })
  ]
});

const app = createApp({ plugins: [...screen, defineFeature("board", { projections: [boardItems] })] });

// A headless test plays the gesture with no pointer: the gate gets "merge" with both payloads.
app.input.drag({ projection: "board.items", key: "a1" }, { projection: "board.items", key: "b2" });
```

:::gotchas
- **Payloads are merged, not nested.** `{ from }` of the drag and `{ to }` of the target reach the node as one `{ from, to }`.
- **A press while a guide stands answers `blocked`.** Outside the guide's window no view is reached.
- **`Pointer.id` changes when another finger takes over.** A system that measures travel starts over then.
:::

## Related

- [flow](/docs/game/plugins/flow/): the gate the answers reach.
- [ui](/docs/game/plugins/ui/): buttons answer through the same gate.
- [Testing](/docs/game/guides/testing/): driving gestures headless.
