---
title: What the kernel checks
description: "Seven checks and the exact error for each."
section: Concepts
order: 5
---

## When checks run

The kernel refuses a broken composition before any plugin code runs. Every failure is a thrown
error in two lines: what is wrong, then how to fix it. The first line starts with the framework id
in brackets. In `@moku-labs/web` that is `[web]`.

:::flow
1. `createPlugin`: the plugin spec is checked, for example `events` must be a function.
2. `createApp`: names and dependencies are checked, before any `createState` or `onInit`.
3. `app.start()`: the app must not be started twice.
:::

| Phase | What is checked |
| --- | --- |
| `createPlugin` | The shape of the spec. |
| `createApp` | Unique names, reserved names, core plugin names, every dependency present and earlier in the list. |
| `start` and `stop` | `start()` once per app, `stop()` only after `start()`. |

Type errors come first. Most mistakes on this page also fail `tsc`, so an editor shows them as you
type. The runtime checks catch the rest: a list built at runtime, a cast, plain JavaScript.

## The checks

Each message below is captured from the installed kernel when the site is built, by making the
mistake for real. It is never typed by hand, so it cannot drift from what your app prints.

<!-- kernel-errors -->

## Why errors and not warnings

Agents act on errors more reliably than on warnings. A startup error with the plugin name in it
is an early, low-cost check, so the kernel makes it impossible to skip.
