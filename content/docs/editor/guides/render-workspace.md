---
title: The Render workspace
description: "Mission control: one source at a time, a 2-minute frame timeline, the cards, Connect device, and the device presets."
section: Guides
order: 13
---

## One source at a time

Render shows **one source**, named in its connection bar. Every number on the page comes from it:
the **local preview**, the page's own game frame, or **one phone**. The `activeSource` plugin keeps
the choice for the whole page, so a view never mixes two games.

While a phone is the source, the local game frame is paused under a veil: "Paused · Galaxy A26
is the source." with Use local preview. A game you paused yourself stays paused.

## What the page shows

| Part | What it is |
|---|---|
| Connection bar | The source pill with its health line and latency, the facts (rate, build, browser, display, OS), a Paused chip, and Connect device, Record, Monitoring, Use local preview. |
| Frame timeline | A 2-minute history kept on the tools page, with a GC lane, rate-change, recording, compile and source-switch marks, and a Shaders & passes lane. Spans of 6 s, 30 s and 2 min. |
| Inspector | Click or drag frames. It reads the range: systems with their files, nodes, passes, filters, compiles, rate changes, spikes, GCs, object counts. |
| Cards | FPS with the rate switch (60, 120 or adaptive, through `game.frameRate`), frame time, draw calls, textures, GPU passes, memory, and device load for a phone by wire. |
| Scene details | Render tree, textures, bundles, pools, release log. Collapsed by default. Never read from a phone. |

| Key | Does |
|---|---|
| → | Step one frame |
| Shift+→ | Jump to the next spike |
| Space | Pause |
| Esc | Clear the selection |

**Record** starts, stops and marks the source's log (`editor.record`) and says who started it.
**Monitoring** says what is measured and switches the overdraw heat map (`game.debug { overdraw }`).
A switch the build refuses says so.

## Numbers you can trust

- **Not measured is never 0.** An engine without a block, an iPhone with no GPU timer, and a section switched off each say so in words.
- **A phone's heap comes from the computer.** The bin attaches CDP to the game's WebView over USB and reads `Runtime.getHeapUsage`. The WebView's own `performance.memory` is never shown as the phone's heap. A phone on the network reads "Not available: connect by wire to read the heap".
- **Wired telemetry.** For an Android phone by wire, once a second the server reads the GPU clock and busy %, CPU and memory per process, the JS heap and the inferred GCs over adb. Every reading names its source, or says why it is not available.
- **The phone only reads.** The marks, the pass chains and the 2-minute history are built on the tools page.

| Feed | How Render reads it |
|---|---|
| `editor.perf.second` | Watched, once a second: rate, facts, Monitoring, capabilities |
| `editor.perf.frames { after }` | Read once a second: only the frames after the last one |
| `editor.perf.events { after }` | Read after the frames: rate, GC, shader, problem, recording and mark lines |
| `editor.perf.passes` | Watched, once a second: the pass rows of the newest full second |
| `editor.perf.detail { from, to }` | Read once per selection |
| `editor.recorder` | Watched: the recording, who started it, the last 32 marks |
| `editor.deviceTelemetry` | Published by the server for a phone by wire, once a second |

A source whose agent is older than these feeds gets nothing new, and the page says so.

## Connect a device

Connect device, in the connection bar or in the top bar's source menu, opens the Connect panel.

| Tab | How it links |
|---|---|
| **By wire** | Android with USB or wireless debugging. The panel lists the phones `adb devices -l` reports, every 2 s. Connect turns device mode on (`127.0.0.1:47600`), the server runs `adb reverse`, and the debug build on the phone dials in. No code needed. |
| **On the network** | The same Wi-Fi. Listen on the network shows the address the phone dials. Build the game with `--editor <address>`, or pick the address on the overlay's Link tab. Type the four-digit code the phone shows, then Link. Nothing is scanned: the phone dials the computer. |
| **Linked devices** | The phones linked in this run, each with Use. Stop device mode unlinks every phone. |

When the active phone leaves, the page goes back to the local preview, shows a notice in every
workspace and marks the timeline. The same phone back within 15 s is the source again.

The Game workspace reads no scene from a phone. The picker stays off there, while the game's
commands still run on the phone.

| Message | Why |
|---|---|
| "Allow USB debugging on the phone" | The phone is plugged in but not authorized. |
| "No debug game answered on SM-A266B" | A ready phone with no debug build running after 20 s. A release build has no agent. |
| "adb not found" | Install Android platform-tools to connect by wire. On the network works without it. |
| "iPhone and iPad: not available yet" | There is no iOS debug build to link. |

## Devices

The viewport presets of the game frame. Sizes are the portrait viewport in CSS px. A fresh viewer
starts on the iPhone 18 Pro. **approx** marks sizes or insets that are estimates, not published
figures.

| Group | Preset | Viewport | DPR | Safe top / bottom |
|---|---|---|---|---|
| iPhone | iPhone SE 3 | 375 × 667 | 2 | 20 / 0 |
| iPhone | iPhone 15 | 393 × 852 | 3 | 59 / 34 |
| iPhone | iPhone 17e · approx | 390 × 844 | 3 | 47 / 34 |
| iPhone | iPhone Air · approx | 420 × 912 | 3 | 68 / 34 |
| iPhone | iPhone 18 Pro · approx (default) | 402 × 874 | 3 | 62 / 34 |
| iPhone | iPhone 18 Pro Max · approx | 440 × 956 | 3 | 62 / 34 |
| iPhone | iPhone 15 Pro Max | 430 × 932 | 3 | 59 / 34 |
| iPhone | iPhone 16 Pro | 402 × 874 | 3 | 62 / 34 |
| iPhone | iPhone 16 Pro Max | 440 × 956 | 3 | 62 / 34 |
| Android | Galaxy S24 | 360 × 780 | 3 | 0 / 0 |
| Android | Galaxy A55 | 412 × 892 | 2.625 | 0 / 0 |
| Android | Redmi Note 13 · approx | 393 × 873 | 2.75 | 0 / 0 |
| Android | Pixel 8 | 412 × 915 | 2.625 | 0 / 0 |
| Android | Xperia 1 V 21:9 | 411 × 960 | 4 | 0 / 0 |
| Foldable | Galaxy Z Fold 6 · approx | cover 369 × 905, inner 707 × 823 | 2.625 | 0 / 0 |
| Foldable | Galaxy Z Flip 6 | 412 × 1005 | 2.625 | 0 / 0 |
| Foldable | Pixel 9 Pro Fold · approx | cover 411 × 923, inner 791 × 820 | 2.625 | 0 / 0 |
| Foldable | iPhone Duo · approx | cover 466 × 678, inner 890 × 626 | 3 | 0 / 0 |
| Tablet | iPad mini 7 | 744 × 1133 | 2 | 0 / 0 |
| Tablet | iPad Air 11" | 820 × 1180 | 2 | 0 / 0 |
| Desktop | Desktop | 1440 × 900 | 1 | 0 / 0 |

**Fit** uses one scale for every preset of a kind, so an iPhone SE 3 shows smaller than an iPhone
18 Pro Max, in their real proportion. **100 %** is one CSS px per device px. A foldable starts
folded; its Unfold / Fold button switches the screen live, and the game sees a resize, not a
reload. Android, foldable and tablet browsers report no safe insets.

:::gotchas
- **One source per page.** A view never mixes the local preview and a phone.
- **On the network needs a native debug build on Android.** A game in a phone browser cannot link.
- **The JS heap of a phone needs a wire.** On the network the Memory card says why it is empty.
- **Under `moku-editor perf` device mode belongs to perf.** Its tools page has no local preview, and a LAN phone's code is typed in the terminal.
:::

## Related

- [On a phone](/docs/editor/guides/on-a-phone/): the debug build, the overlay and the log.
- [tools plugins](/docs/editor/plugins/tools/): `activeSource` and `renderView`.
- [server plugins](/docs/editor/plugins/server/): `connect` and `collector`.
