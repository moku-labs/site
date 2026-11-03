---
title: limits
description: "Per-lane token bucket, concurrency gate and circuit breaker for all provider traffic. Injected as ctx.limits."
section: Pipeline
order: 17
---

## What it does

**Core plugin.** A lane is a name for one stream of provider traffic. The runner uses
`{task}/{provider}/default`, such as `video/fal/default`. Each lane has a rate limit, a concurrency
limit and a circuit breaker. Lanes are global: two runs in one process share them.


## Config

`pluginConfigs.limits`.

| Option | Type | Default | Description |
|---|---|---|---|
| `defaults.rpm` | `number` | `60` | Requests per minute. Also the bucket capacity. |
| `defaults.concurrency` | `number` | `4` | Calls in flight. |
| `defaults.breakerThreshold` | `number` | `5` | Retryable failures in a row that open the breaker. |
| `defaults.breakerCooldownMs` | `number` | `30000` | How long the breaker stays open before a probe. |
| `lanes` | `Record<string, Partial<LaneConfig>>` | `{}` | Overrides by exact lane or by `task/provider` prefix. |

An exact lane wins over a prefix, and a prefix wins over `defaults`. Config merges shallowly, so a
`defaults` object must be complete.

## API

Mounted at `app.limits` and `ctx.limits`.

| Method | Signature | Description |
|---|---|---|
| `acquire` | `(lane: string, opts?: { signal? }) => Promise<{ release }>` | Waits for a token and a slot. Rejects at once with `reason: "breaker-open"` when the breaker is open. |
| `reportOutcome` | `(lane: string, outcome: "ok" \| "retryable-error") => void` | Feeds the breaker. |
| `laneConfig` | `(lane: string) => LaneConfig` | The effective settings. |
| `snapshot` | `(lane: string) => LaneSnapshot` | `{ lane, tokens, inFlight, waiting, breaker }`. |
| `lanes` | `() => string[]` | Every lane seen so far. |

## Events

### Emits

None.

### Listens to

None.

## Depends on

Nothing.
