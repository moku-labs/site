---
title: deep-link
description: "The launch URL and later deliveries, filtered by scheme. Each launch URL arrives once."
section: Plugins
kind: optional
order: 14
---

## What it does

`deepLink` answers two questions: which URL opened the app, and which URLs arrive while it runs.

## How it works

**In the shell.** The OS listener and `getCurrent()` can both see the launch URL, in any order. For
the first 5 seconds the plugin keeps a record, so each launch URL reaches your code once. After that
every delivery goes through, the same link twice included.

**On the web.** There is no push channel, so `onOpen` never fires. The page's own address is not a
deep link either. The provider reads one explicit, percent-encoded parameter:

```text
https://app.example/?deeplink=myapp%3A%2F%2Fopen%3Fid%3D1
```

`#deeplink=` works too. Anything else resolves `ok(null)`. A value with the scheme `javascript`,
`data`, `vbscript`, `blob` or `file` is refused before your allowlist sees it.

## Config

`pluginConfigs.deepLink`.

| Option | Type | Default | Description |
|---|---|---|---|
| `schemes` | `string[]` | `[]` | The allowed schemes, lowercase. Empty accepts all. An invalid entry throws a `TypeError` at `createApp`. |

## API

Mounted at `app.deepLink`.

| Method | Signature | Description |
|---|---|---|
| `getCurrent` | `() => Promise<SystemResult<string \| null>>` | The launch URL, filtered by scheme. `ok(null)` when there is none. |
| `onOpen` | `(cb: (payload: { url: string }) => void) => () => void` | Subscribes to deliveries. Local and synchronous. Returns the remover. |

## Events

### Emits

| Event | Payload | When |
|---|---|---|
| `deepLink:open` | `{ url: string }` | A URL reached the running app, after the launch record and the scheme filter. |

### Listens to

None.

## Depends on

- The core `runtime` plugin.
- In the shell: `@tauri-apps/plugin-deep-link`, plus in native both `{ name: "deep-link" }` in `config.system` and `capabilities: { "deep-link": { mode: "scheme", scheme: "myapp" } }`.

## Example

```ts file="src/links.ts" check
import { createApp, createPlugin } from "@moku-labs/system";
import { deepLinkPlugin } from "@moku-labs/system/deep-link";

const opened: string[] = [];

const linkLog = createPlugin("linkLog", {
  depends: [deepLinkPlugin], // [!note] The event is typed for plugins that depend on this one.
  hooks: () => ({
    "deepLink:open": ({ url }) => {
      opened.push(url);
    }
  })
});

const system = createApp({
  plugins: [deepLinkPlugin, linkLog],
  pluginConfigs: { deepLink: { schemes: ["myapp"] } }
});
await system.start();

const launch = await system.deepLink.getCurrent();
if (launch.ok && launch.value !== null) console.log("opened with", launch.value);

const stopListening = system.deepLink.onOpen(({ url }) => console.log("delivered", url));
stopListening();
```

:::gotchas
- **Custom schemes only in native.** The packager's `deep-link` mode is `scheme`. Universal links and app links are not there yet.
- **The name differs.** `deepLink` here, `deep-link` in `config.system`.
:::

## Related

- [native project plugin](/docs/native/plugins/project/): how the scheme is packaged.
