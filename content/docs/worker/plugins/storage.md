---
title: storage
description: "Cloudflare R2 object storage: get, put, delete, list, plus an optional upload directory at deploy."
section: Plugins
kind: optional
order: 24
---

## What it does

`storage` reads and writes objects in R2 buckets. The default bucket sits on `app.storage`, and
`use(key)` selects another one. A bucket can also declare a directory that `deploy` uploads.

## How it works

The bucket is resolved from `env` on every call. A missing binding comes back as a rejected promise,
so `await` and `.catch` are enough.

`put` passes only the key and the value to R2. For HTTP metadata or conditional writes, take the raw
bucket with `app.bindings.require`.

## Config

`pluginConfigs.storage`, keyed by your logical name. The default is `{}`.

| Option | Type | Default | Description |
|---|---|---|---|
| `[key].name` | `string` | required | The Cloudflare bucket. A stage other than `production` suffixes it at deploy. |
| `[key].binding` | `string` | required | The key on `env`. |
| `[key].upload` | `string` | none | A directory uploaded at deploy. Deploy metadata: never read at request time. |
| `[key].default` | `boolean` | none | Marks the default when there are several. |

## API

Mounted at `app.storage`, reachable with `require(storagePlugin)` in a handler.

| Method | Signature | Description |
|---|---|---|
| `get` | `(env, key: string) => Promise<R2ObjectBody \| null>` | The object with its `.body` stream, or `null`. |
| `put` | `(env, key: string, value: ReadableStream \| ArrayBuffer \| ArrayBufferView \| string \| Blob \| null) => Promise<R2Object>` | Writes an object. |
| `delete` | `(env, key: string \| string[]) => Promise<void>` | Removes one key or many. Absent keys are fine. |
| `list` | `(env, opts?: R2ListOptions) => Promise<R2Objects>` | One page. Follow `.truncated` and `.cursor`. |
| `use` | `(key: string) => StorageBucketApi` | The same four methods on another bucket. |
| `deployManifest` | `() => { kind: "r2"; name: string; binding: string; upload?: string }[]` | Build-time metadata. Takes no `env`. |

## Events

### Emits

None. `deploy` reports the upload through `deploy:phase`.

### Listens to

None.

## Depends on

- [bindings](/docs/worker/plugins/bindings/): resolves the bucket on every call.

## Example

```ts file="src/app.ts" check
import { createApp, endpoint, storagePlugin } from "@moku-labs/worker";

export const app = createApp({
  plugins: [storagePlugin],
  pluginConfigs: {
    storage: { files: { name: "my-files", binding: "FILES", upload: "./public" } },
    server: {
      endpoints: [
        endpoint("/files/{key}").get(async ({ params, env, require }) => {
          const object = await require(storagePlugin).get(env, params.key);
          return object === null ? new Response("Not Found", { status: 404 }) : new Response(object.body);
        }),
        endpoint("/files/{key}").put(async ({ params, request, env, require }) => {
          const object = await require(storagePlugin).put(env, params.key, request.body); // [!note] A stream goes straight through, with no buffering.
          return Response.json({ size: object.size, etag: object.etag }, { status: 201 });
        }),
        endpoint("/files").get(async ({ url, env, require }) => {
          const prefix = url.searchParams.get("prefix") ?? "";
          const { objects, truncated } = await require(storagePlugin).list(env, { prefix, limit: 100 });
          return Response.json({ keys: objects.map((object: { key: string }) => object.key), truncated });
        })
      ]
    }
  }
});
```

:::gotchas
- **Only the first bucket uploads.** `deploy` looks at the first R2 instance only. An `upload` on a later bucket is ignored, and so is every `upload` when the first bucket has none.
- **`upload` adds and overwrites.** It runs one `wrangler r2 object put` per file on each deploy. It never deletes old objects, and a large directory takes time.
- **A key has no slash in a `{key}` param.** A param matches one path segment. `/files/a/b.png` does not match `/files/{key}`.
- **A non-empty bucket blocks teardown.** Cloudflare refuses to delete it and the report comes back `failed`.
:::

## Related

- [deploy plugin](/docs/worker/plugins/deploy/): the upload step.
- [How it works](/docs/worker/how-it-works/): keyed resources.
