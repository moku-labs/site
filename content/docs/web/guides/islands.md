---
title: Islands
description: "createIsland: state, render, events and an API for the parts of a page that run in the browser."
section: Guides
order: 11
---

## How islands work

An island is the part of a page that runs in the browser. The build renders the whole page to
HTML, islands included. In the browser, `app.start()` finds every element with
`data-island="name"` and mounts the island registered under that name onto it.

An island outside the swap region (`spa.swapSelector`, `main > section` by default) is
**persistent**: it survives navigation and hears `onNavStart` and `onNavEnd`. An island inside
the swap region is **page-specific**: it is destroyed and created again with the page.

`createIsland(name, spec)` takes a spec shaped like a plugin:

| Key | What it is |
|---|---|
| `state(ctx)` | Builds the per-element state once, at mount. |
| `render(state, ctx)` | Returns what the element shows. Runs after mount and after every `ctx.set`, batched. |
| `events` | `"event selector"` → handler. One delegated listener per event type, removed on destroy. |
| `api(ctx)` | A public API other islands reach with `ctx.island(name)`. |
| `onCreate` … `onDestroy` | Lifecycle hooks. |

Every key is optional. A spec with only hooks is fine.

## Example

```tsx file="src/islands/like-button.tsx" group="islands" check
import { createIsland } from "@moku-labs/web/browser";

type LikeState = { count: number; liked: boolean };

export const likeButton = createIsland("like-button", { // [!note] The name matches `data-island="like-button"`. It must not be empty.
  state: (ctx): LikeState => ({
    count: Number(ctx.el.getAttribute("data-count") ?? 0), // [!note] State is per element. Seed it from the server-rendered attributes.
    liked: false
  }),
  render: state => (
    <button type="button" aria-pressed={state.liked}>
      Like {state.count}
    </button>
  ),
  events: {
    "click button": ctx => // [!note] `ctx.set` merges a patch, or an updater's result, and schedules one render.
      ctx.set(previous => ({
        liked: !previous.liked,
        count: previous.count + (previous.liked ? -1 : 1)
      }))
  },
  api: ctx => ({ count: () => ctx.state.count }) // [!note] Other islands read it with `ctx.island("like-button")`.
});
```

```tsx file="src/components/post-footer.tsx" group="islands" hl="4" check
export function PostFooter(props: { likes: number }) {
  return (
    <footer>
      <div data-island="like-button" data-count={String(props.likes)}>
        <button type="button">Like {props.likes}</button>
      </div>
    </footer>
  );
}
```

```ts file="src/client.ts" group="islands" hl="3,7"
import { createApp } from "@moku-labs/web/browser";
import { site } from "./site";
import { likeButton } from "./islands/like-button";
import { routes } from "./routes";

const app = createApp({
  pluginConfigs: { site, router: { routes }, spa: { islands: [likeButton] } }
});

await app.start();
```

The static HTML already shows `Like 3`, so the page is correct with JavaScript off. On mount
the island renders over it and takes over the clicks.

## At build

Islands ship in the client bundle. The build bundles `build.clientEntry` (or the first of
`src/client/main.ts`, `src/client/main.tsx`, `src/main.ts`) and links it into every page.

```sh terminal title="build"
$ bun run build
▟▙ moku web  build                                       v2.4.11
✓ bundle · 5ms
✓ pages · 5ms
✓ BUILD · 9 pages                                1252ms · ./dist/
$ ls dist/assets
chunk-9g7zwee8.js  chunk-a5gpvyg6.js  chunk-hm1r9zq7.js  chunk-ja8ap6vw.js
client-7wyejjw7.js  main-gzka1ns2.css
```

Every bundle file name carries a content hash, so the generated `_headers` can mark them
immutable.

## The island context

Every hook, `render`, `state`, event handler and `api` gets the same `ctx`.

| Member | What it is |
|---|---|
| `el` | The bound element. |
| `data` | Page data parsed from `script#__DATA__`, or `{}`. |
| `params`, `meta`, `locale` | The matched route's params, `.meta()` bag and locale. |
| `url(name, params?)` | A link, same output as `app.router.toUrl`. |
| `navigate(path, options?)` | SPA navigation, no `app` needed. `options = { scroll?, replace? }`. |
| `state` | The live state. `undefined` for a hooks-only island. |
| `set(patch)` | Merge a patch, or `prev => patch`, and schedule one render. |
| `flush()` | Render now. Mostly for tests. |
| `cleanup(dispose)` | Run on destroy, last in first out: timers, subscriptions, global listeners. |
| `island<T>(name)` | Another island's `api`, or `undefined`. |

## Lifecycle hooks

| Hook | When |
|---|---|
| `onCreate` | Once, before the instance attaches. |
| `onMount` | After it attaches. May be async. |
| `onNavStart` | A navigation begins while it is mounted. |
| `onNavEnd` | A navigation finished. Persistent islands only. |
| `onUnMount` | Before it detaches. |
| `onDestroy` | Once, after it detaches. |

A hooks-only island that marks navigation state on a persistent element:

```ts file="src/islands/nav-state.ts" check
import { createIsland } from "@moku-labs/web/browser";

export const navState = createIsland("nav-state", {
  onNavStart({ el }) {
    el.setAttribute("data-loading", "");
  },
  onNavEnd({ el }) {
    el.removeAttribute("data-loading");
  }
});
```

## Talk to another island

```tsx file="src/islands/share.tsx" check
import { createIsland } from "@moku-labs/web/browser";

type LikeApi = { count: () => number };

export const share = createIsland("share", {
  state: () => ({ text: "Share" }),
  render: state => <button type="button">{state.text}</button>,
  events: {
    "click button": ctx => {
      const likes = ctx.island<LikeApi>("like-button")?.count() ?? 0; // [!note] `undefined` when no `like-button` island is registered.
      ctx.set({ text: `Share (${likes} likes)` });
    }
  }
});
```

## Realtime channels

`createChannel` is a WebSocket that reconnects on its own for islands that consume a server push stream, such
as a Durable Object from `@moku-labs/worker`. It reconnects with backoff, can send a keepalive,
buffers frames until you `seed`, and counts subscribers: the first connects, the last
disconnects.

```ts file="src/islands/board.ts" check
import { createChannel, createIsland } from "@moku-labs/web/browser";

type BoardPatch = { type: "card.moved"; cardId: string; to: string };

const board = createChannel<BoardPatch>({
  url: id => `${location.origin.replace(/^http/, "ws")}/ws/board/${id}`,
  keepAlive: { send: "ping", ignore: "pong" },
  bufferUntilSeed: true // [!note] Frames that arrive before `seed` are queued, so the connect-then-load race drops nothing.
});

export const boardIsland = createIsland("board", {
  state: () => ({ moves: 0 }),
  render: state => `<p>${state.moves} moves</p>`,
  onMount(ctx) {
    const boardId = ctx.params.id ?? "";
    const off = board.subscribe(boardId, () => ctx.set(previous => ({ moves: previous.moves + 1 })));
    ctx.cleanup(off);
    board.seed(boardId);
  }
});
```

## Test an island

`@moku-labs/web/testing` mounts one island through the real spa internals, with no `createApp`,
router or network. The test runner needs a DOM (happy-dom or jsdom).

```ts file="tests/counter.test.ts" check
import { createIsland } from "@moku-labs/web/browser";
import { mountIsland } from "@moku-labs/web/testing";
import { expect, it } from "vitest";

const counter = createIsland("counter", {
  state: () => ({ count: 0 }),
  render: state => `<button type="button">${state.count}</button>`,
  events: { "click button": ctx => ctx.set(previous => ({ count: previous.count + 1 })) }
});

it("counts clicks", () => {
  const island = mountIsland<{ count: number }>(counter);
  island.flush();
  island.fire("click button"); // [!note] Same `"event selector"` grammar as the `events` map.
  island.flush();
  expect(island.el.textContent).toBe("1");
});
```

`renderIsland(render, { state })` renders only the `render` function, for fast,
render-only tests. An island that returns JSX needs `await island.settle()` first, which loads the lazy
Preact render chunk.

:::gotchas
- **There is no `createComponent` in 2.4.11.** The `state`, `render`, `events` and `api` spec lives on `createIsland`.
- **`render` replaces the server markup on mount.** Render the same markup the server rendered, or the content shifts on mount.
- **Return `null` for an empty island.** It unmounts the Preact tree and stays mountable. Returning `""` corrupts Preact's tree and the island never renders again.
- **`ctx.data` reads `script#__DATA__`.** The build does not write that script. Render it in your page when an island needs page data, or read `data-*` attributes.
- **A duplicate name replaces the first island.** `register` logs `spa:island-collision` and the last one wins.
- **A typo in a hook name throws.** `onMout` fails `createIsland` with `[web] unknown island hook "onMout" on "x"` and the list of valid hooks.
:::

## Related

- [spa plugin](/docs/web/plugins/spa/): `islands`, `swapSelector`, the API at `app.spa`.
- [SPA navigation](/docs/web/guides/spa/): what happens to islands on a link click.
- [API reference](/docs/web/api/): `createIsland`, `createChannel`, `lazyEmbed`.
