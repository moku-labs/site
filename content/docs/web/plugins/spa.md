---
title: spa
description: "Default. The client runtime: island hydration, intercepted navigation, head sync and a progress bar. Inert on Node."
section: Plugins
order: 30
---

## What it does

**Isomorphic default.** `spa` makes the static site live in the browser. It mounts islands onto
the server-rendered HTML, intercepts in-app links, swaps one page region without a full reload,
syncs the head and shows a progress bar. On Node it does nothing, so the same app definition
works in the build.

It is the one default plugin that owns a browser resource, so it is the one with `onStart` and
`onStop`.

## How it works

While `createApp` runs, `spa` builds a single kernel, validates its config, registers
`config.islands` and records the current URL. It looks for the optional `data` plugin with
`ctx.has("data")`.

`app.start()` boots the kernel in the browser: it attaches the navigation listeners and mounts
every `[data-island]` element. An island outside the swap region is persistent; one inside it is
created and destroyed with each page. `app.stop()` unmounts every island and detaches the
listeners.

A navigation takes the first path that works:

| Path | Used when | What happens |
|---|---|---|
| Data | `router.mode()` is not `"ssg"` and `data` is composed, or the route is client-only in `spa` mode | `router.match` → `data.at(path)` → the route's `render` into the swap region → islands re-mounted → title set |
| HTML-over-fetch | the data path is not available or fails | fetch the page, replace `swapSelector`, copy the head |
| Full load | the fetch fails | `location.href` |

The Navigation API is used where the browser has it, the History API otherwise. Clicks with a
modifier key, `target="_blank"`, other origins and links to static files are left to the
browser. Scroll positions are saved per page in `sessionStorage` and restored on back and
forward. The progress bar waits 150 ms before it shows.

## Config

`pluginConfigs.spa`. Every field is optional.

| Option | Type | Default | Description |
|---|---|---|---|
| `swapSelector` | `string` | `"main > section"` | The region replaced on navigation. Must be a valid CSS selector. |
| `viewTransitions` | `boolean \| TransitionMode` | `false` | `true` is `"crossfade"`, `false` is `"none"`. Modes: `"none"`, `"crossfade"`, `"slide"`, `"morph"`. A route's `.transition()` overrides it. |
| `scrollRestoration` | `"top" \| "preserve"` | `"top"` | Scroll after a forward navigation. A route's `.scroll()` overrides it. Back and forward always restore. |
| `progressBar` | `boolean` | `true` | The top progress bar. |
| `islands` | `IslandDef[]` | `[]` | Islands registered while `createApp` runs. |

## API

Mounted at `app.spa`, reachable with `ctx.require(spaPlugin)`. Every method is a no-op before
`app.start()` and on Node.

| Method | Signature | Description |
|---|---|---|
| `register` | `(island: IslandDef) => void` | Registers an island. A second island with the same name replaces the first and logs `spa:island-collision`. |
| `navigate` | `(path: string, options?: { scroll?, replace? }) => void` | Navigates through the swap pipeline. `replace: true` replaces the history entry. |
| `hardNavigate` | `(url: string) => void` | A real page load, for a boundary the SPA cannot swap: another layout, the auth split. |
| `current` | `() => string` | The current `pathname + search`. `""` on Node. |
| `island` | `<T>(name: string) => T \| undefined` | Another island's `api`, or `undefined`. |

The module-scope `navigate(path, options?)` and `hardNavigate(url)` from
`@moku-labs/web/browser` call the same kernel, for code with no app or island context.

## Events

### Emits

| Event | Payload | When |
|---|---|---|
| `spa:navigate` | `{ from: string; to: string }` | A navigation was intercepted and starts. |
| `spa:navigated` | `{ url: string }` | The swap finished and the new URL is active. |
| `spa:island-mount` | `{ name: string; el: Element }` | An island attached to an element. |
| `spa:island-unmount` | `{ name: string; el: Element }` | An island detached from an element. |

### Listens to

None.

## Depends on

- [router](/docs/web/plugins/router/): `match`, `mode`, `toUrl`.
- [head](/docs/web/plugins/head/): `composeTitle` for the data path.
- [data](/docs/web/plugins/data/), optional: `at(path)` for the data path.

## Example

```tsx file="src/client.tsx" check
import { createApp, createIsland, dataPlugin, defineRoutes, route } from "@moku-labs/web/browser";

const routes = defineRoutes({
  home: route("/").render(() => <h1>Home</h1>),
  board: route("/board/{id}/")
    .render(ctx => <h1>Board {ctx.params.id}</h1>)
    .transition("slide")
});

const counter = createIsland("counter", {
  state: () => ({ count: 0 }),
  render: state => <button type="button">{state.count}</button>,
  events: { "click button": ctx => ctx.set(previous => ({ count: previous.count + 1 })) }
});

const app = createApp({
  plugins: [dataPlugin],
  config: { mode: "hybrid" },
  pluginConfigs: {
    site: { name: "Boards", url: "https://boards.dev", author: "Ada", description: "Kanban." },
    router: { routes },
    spa: {
      swapSelector: "main > section", // [!note] Must exist in every page's layout.
      viewTransitions: "crossfade",
      scrollRestoration: "top",
      islands: [counter]
    }
  }
});

await app.start(); // [!note] Mounts islands and starts intercepting links. Does nothing on Node.
app.spa.navigate("/board/42/"); // [!note] Slides, because the `board` route says so.
console.log(app.spa.current());
```

:::gotchas
- **One app per page.** The teardown handles live at module scope. Two apps in one page share them.
- **`swapSelector` must match your layout.** A selector that matches nothing makes every navigation a full load. A syntax error throws `[web] spa.swapSelector is not a valid CSS selector` when the browser app is created; Node has no DOM to check it.
- **The layout is not re-applied.** On navigation only the swap region changes. `.layout()` runs at build only.
- **`load` does not run on the client.** The data path uses the JSON the build saved. A client-only route in `spa` mode renders with `ctx.data = {}`.
- **Use `@moku-labs/web/browser` for the client.** Its import graph has no Node module.
:::

## Related

- [SPA navigation](/docs/web/guides/spa/): transitions, scroll, programmatic navigation, events.
- [Islands](/docs/web/guides/islands/): `createIsland` in full.
- [Data](/docs/web/guides/data/): the data path.
