# Snippet stubs: game

The smallest game folder the game docs examples import from: the dice game of the quick start.
`src/lib/snippets.ts` copies this folder into the project of every `check` block of
`content/docs/game/`, then writes the blocks over it. A block's relative import that its own
`group` does not hold resolves here.

| File | Holds |
|---|---|
| `state.ts` | The kit: `defineGame` bound to the dice game's `Player` and `Session` |
| `nodes.ts` | The nodes `home`, `roll` and `reset` |
| `flow.ts` | `mainFlow`, the edge table |
| `index.ts` | The game as one data object, `defineGameApp` |
| `config.ts` | The page, as plain data that `satisfies GameConfig` |
| `generated/assets.ts` | The key module in the shape `moku-game keys` writes, for a `board` and a `ui` bundle |
| `generated/strings.ts` | The `Strings` type `moku-game keys` would write, for the keys the screen examples use |

Stubs are real code against the installed `@moku-labs/game`. A stub that stops compiling fails
the test run.

These files are fixtures, never an app entry. Do not import them from `src/` or `scripts/`.
