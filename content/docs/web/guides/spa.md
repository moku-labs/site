---
title: SPA navigation
description: "Intercepted links, region swaps, view transitions, scroll and programmatic navigation."
section: Guides
order: 16
---

## How navigation works

After `app.start()` in the browser, the `spa` plugin intercepts same-origin link clicks. It
leaves alone clicks with a modifier key, links with `target="_blank"`, other origins and static
files such as `.xml`, `.json`, images, fonts and PDFs. It uses the Navigation API where the
browser has it, and the History API otherwise.

Every navigation takes the first path that works:

:::steps
1. **Data path.** When `router.mode()` is not `"ssg"` and the `data` plugin is composed: match the route, fetch the page JSON, run the route's `render` into the swap region, re-mount the islands, set the title.
2. **HTML-over-fetch.** Fetch the next page's HTML, replace the `swapSelector` region, copy the head from the fetched document.
3. **Full page load.** When the fetch fails, the browser loads the URL normally.
:::

Only the swap region changes: `main > section` by default. The header, the footer and the
persistent islands stay. A thin progress bar shows after 150 ms, so fast navigations show
nothing. Back and forward restore the scroll position saved for that page.

## Per-route transitions and scroll

The app sets the default on the `spa` plugin. A route overrides it for navigations to that
route.

```tsx file="src/routes.tsx" group="spa" check
import { defineRoutes, route } from "@moku-labs/web/browser";

export const routes = defineRoutes({
  board: route("/board/{id}/")
    .render(ctx => <section data-board={ctx.params.id} />)
    .transition("slide"), // [!note] Navigations to a board slide. The swap is tagged so CSS can target it.
  issue: route("/board/{id}/issue/{issueId}/")
    .render(ctx => <section data-issue={ctx.params.issueId} />)
    .transition("morph") // [!note] A shared `view-transition-name` morphs the card into the panel.
    .scroll("preserve") // [!note] An overlay route: the board behind it does not move.
});
```

```ts file="src/client.ts" group="spa" hl="7"
import { createApp } from "@moku-labs/web/browser";
import { routes } from "./routes";
import { site } from "./site";

const app = createApp({
  config: { mode: "spa" },
  pluginConfigs: { site, router: { routes }, spa: { viewTransitions: "crossfade", scrollRestoration: "top" } }
});

await app.start();
```

```css file="src/styles/transitions.css" group="spa"
:root[data-view-transition~="slide"]::view-transition-old(root) {
  animation: slide-out 200ms ease-in;
}

:root[data-view-transition~="slide"]::view-transition-new(root) {
  animation: slide-in 200ms ease-out;
}
```

`viewTransitions` takes `true` (crossfade), `false` (no transition) or a mode: `"none"`,
`"crossfade"`, `"slide"`, `"morph"`. A named mode is set on `:root` as `data-view-transition` and
as a view transition type, for `:active-view-transition-type(slide)`. Under
`prefers-reduced-motion` and in browsers without View Transitions the swap is instant.

## Navigate from code

| Caller | Call |
|---|---|
| An island | `ctx.navigate(path, { scroll?, replace? })` |
| Code with the app | `app.spa.navigate(path, options)` |
| Module scope, no app or island | `navigate(path, options)` from `@moku-labs/web/browser` |
| Leave the SPA on purpose | `app.spa.hardNavigate(url)` or `hardNavigate(url)` |

```ts file="src/session.ts" check
import { createUrls, defineRoutes, hardNavigate, navigate, route } from "@moku-labs/web/browser";

const routes = defineRoutes({
  board: route("/board/{id}/"),
  signin: route("/signin/")
});

const urls = createUrls(routes);

export function openBoard(id: string): void {
  navigate(urls.toUrl("board", { id })); // [!note] The same swap pipeline as a link click. A no-op before `app.start()`.
}

export function signOut(): void {
  hardNavigate(urls.toUrl("signin")); // [!note] A real page load. The sign-in page has another layout, so it cannot be swapped in.
}
```

`replace: true` swaps the current history entry instead of adding one, so Back skips the page you
came from.

## Listen to navigation

`spa` emits four events. A plugin in the browser app hooks them.

| Event | Payload | When |
|---|---|---|
| `spa:navigate` | `{ from: string; to: string }` | A navigation was intercepted and starts. |
| `spa:navigated` | `{ url: string }` | The swap finished and the new URL is active. |
| `spa:island-mount` | `{ name: string; el: Element }` | An island attached to an element. |
| `spa:island-unmount` | `{ name: string; el: Element }` | An island detached. |

```ts file="src/plugins/analytics.ts" check
import { createPlugin, spaPlugin } from "@moku-labs/web/browser";

export const analyticsPlugin = createPlugin("analytics", {
  depends: [spaPlugin], // [!note] Depending on `spa` makes its events visible to `hooks`, with typed payloads.
  createState: (): { views: string[] } => ({ views: [] }),
  hooks: ctx => ({
    "spa:navigated": ({ url }) => {
      ctx.state.views.push(url);
      ctx.log.info("analytics:view", { url });
    }
  }),
  api: ctx => ({ views: () => [...ctx.state.views] })
});
```

## Try it locally

`bun run dev` builds once, serves `dist/` with live reload and rebuilds on change. Navigation in
the dev server goes through the same SPA runtime as production.

```sh terminal title="dev"
$ bun run dev
▟▙ moku web  serve · dev                                 v2.4.11
✓ pages · 5ms
✓ BUILD · 9 pages                                1252ms · ./dist/
➜ Local    http://localhost:4173
➜ Network  http://192.168.1.20:4173
watching   content, src
~ content
✓ rebuilt 9 pages · 84ms · reloaded
```

:::gotchas
- **`swapSelector` must exist in your layout.** A selector that matches nothing makes every navigation a full page load. An invalid selector throws `[web] spa.swapSelector is not a valid CSS selector` when the browser app is created. On Node there is no DOM to check it, so the build does not catch it.
- **The layout is not re-run.** `.layout()` frames the page at build. On navigation only the swap region changes, so chrome that depends on the page must update itself, for example as a persistent island with `onNavEnd`.
- **One app per page.** The teardown handles live at module scope. Two apps in one page would share them.
- **Programmatic navigation waits for `start()`.** `navigate()` and `app.spa.navigate()` do nothing before the browser app has started, and nothing on Node.
:::

## Related

- [spa plugin](/docs/web/plugins/spa/): config, API, events.
- [Data](/docs/web/guides/data/): the data path in detail.
- [Islands](/docs/web/guides/islands/): persistent and page-specific islands.
- [Routing](/docs/web/guides/routing/): `.transition()` and `.scroll()`.
