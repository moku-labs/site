---
title: text
description: "Screen. MSDF text: the Text component, text styles, inline tags and icons, measurement that is the same in a browser and in Bun."
section: Plugins
order: 32
---

## What it does

`text` draws words. The `Text` component carries a string or a `Message`, the style it is drawn
in, and the resolved string. Glyphs come from MSDF bitmap fonts in a bundle. Sizes come from the
font's advance table, so `measure` gives the same numbers in a browser and in plain Bun.

| Set | Tier | Builds on | Emits |
|---|---|---|---|
| screen, in `screen` | Complex | `world`, `renderer`, `assets`, `i18n` | nothing |

**Styles.** A feature declares its text styles with `defineTextStyles` under its `textStyles` key:
`font`, `size`, `fill`, and the optional `bold`, `italic`, `stroke`, `strokeWidth`,
`letterSpacing`, `align`, `wrap` (a width, `"none"` or `"box"`), `digits` and `lineHeight`. Two
styles are built in: `body` and `digits`, backed by the fonts of the config.

**Tags inside a string.** `<b>`, `<i>`, `<color=#rrggbb>`, `<icon=key>`, `\<` and `\n`.

**Numbers.** `bind(Component, field, { format })` shows a numeric field of the same entity,
written only when the shown string changes. Built-in formats: `int`, `mm:ss`, `h:mm:ss`,
`duration`. `Countdown({ until })` counts down to a `clock` moment; `text` keeps its `left`. A
game's own format is `defineTextFormats({ "pill.number": value => ({ content, style }) })` under
the feature's `textFormats` key.

**Board text.** `label({ text, style, at, anchor? })` gives the `Text` and the `Transform` of a
label, so a projection view reads as one line.

**The body font.** The package ships one MSDF font, `fonts/font-body.*` (Pangolin, SIL OFL 1.1).
Copied into `features/ui/assets/`, it is keyed `ui.font-body`, the default of `fonts.body`. No
digits font ships: a game that uses `digits` brings `ui.font-digits` itself.

## Config

`pluginConfigs.text`.

| Option | Type | Default | Description |
|---|---|---|---|
| `fonts` | `{ body: string; digits: string }` | `{ body: "ui.font-body", digits: "ui.font-digits" }` | The two boot fonts behind the built-in styles. |

## API

Mounted at `app.text`, reachable with `ctx.require(textPlugin)`.

| Method | Signature | Description |
|---|---|---|
| `measure` | `(content: string \| Message, style: string, width?: number) => Size` | The size of a text in reference pixels. Never touches a canvas. |
| `hasGlyph` | `(char: string, style: string) => boolean` | Whether the style's font has the glyph. A missing one is drawn as nothing. |
| `formatted` | `(name: string, value: number) => FormattedNumber \| undefined` | What a game format answers for a number: `{ text, style }`. |
| `styles` | `() => readonly string[]` | The registered style names: the two built-ins first. |
| `replaceStyles` | `(styles: TextStyles) => void` | The dev hot swap of a saved styles file. |

## Events

### Emits

None.

### Listens to

`i18n:locale-changed` (every message is resolved again) and `assets:replaced` (a swapped font).

## Example

```ts file="hud-text.ts" check
import { createApp, defineFeature, defineTextStyles, label, screen } from "@moku-labs/game";

// A feature brings its styles.
export const hudStyles = defineTextStyles({
  "hud.digits": { font: "ui.font-digits", size: 40, fill: 0xffe082, digits: true }
});

const app = createApp({ plugins: [...screen, defineFeature("hud", { textStyles: hudStyles })] });
await app.start();

app.text.styles(); // ["body", "digits", "hud.digits"]
app.text.measure("+5", "hud.digits"); // the same size in a browser and in plain Bun

// Board text in a projection view: the Text and the Transform of one label.
label({ text: "+5", style: "hud.digits", at: { x: 90, y: 180 } });
```

:::gotchas
- **No font size in a layout style.** The size comes from the text style.
- **A format is pure over value and language.** It is not called while the value and the locale stand; a `Countdown` calls it every frame.
- **The font licence goes next to `assets/`, not inside it.** A path in `node_modules` is not an asset key.
:::

## Related

- [i18n](/docs/game/plugins/i18n/): the messages `text` draws.
- [ui](/docs/game/plugins/ui/): the `text` tag of a JSX screen.
- [Screens](/docs/game/guides/screens/): labels on the board.
