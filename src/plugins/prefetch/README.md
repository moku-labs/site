# prefetch

Standard-tier Layer-3 plugin, browser only. Warms the data of the pages a reader is about to open,
so a tap shows the next page without waiting for the network. No API, no events. Composed only in
`src/spa.tsx`; the Node app never loads it.

## How

The SPA reads a page's data through `app.data.at(path)`, which keeps every answer in memory. This
plugin calls the same `data.at(path)` earlier, once per path (`src/lib/link-prefetch.ts`):

| When | Which links |
|---|---|
| A mouse rests on a link for `hoverDelay` ms | that link |
| A finger touches a link (`touchstart`), or it gets keyboard focus | that link |
| The page is idle, after start and after every `spa:navigated` | up to `viewportBudget` links that come into view (off by default) |

Never warmed: other origins, `target` other than `_self`, `download`, paths
that are files (`/llms.txt`, `.md` twins), the current page. Links in view are not warmed on
save-data or a 2g connection.

## Depends, events, API

| | |
|---|---|
| Depends | `dataPlugin` (its `at(path)` cache), `spaPlugin` (the `spa:navigated` event) |
| Events | none emitted; listens to `spa:navigated` |
| API | none |

## Config

| Key | Default | Meaning |
|---|---|---|
| `hoverDelay` | `65` | Milliseconds a mouse rests on a link before its page is warmed |
| `viewportBudget` | `0` | Links in view warmed per page; `0` watches nothing |
| `idleTimeout` | `1200` | Longest wait for an idle moment before links in view are watched |

## Lifecycle

`onStart` adds the document listeners and the viewport observer; `onStop` removes them. A start
after a stop listens again.

## Tests

Unit tests run the hooks against fake `document`, `IntersectionObserver` and timers
(`__tests__/unit/`). The integration level is the browser: `tests/e2e/speed.spec.ts` checks that a
touched link's data is fetched before the tap and only once. A Node `createApp` test is not used,
because the browser app's `start()` needs a real DOM.
