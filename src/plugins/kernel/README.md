# kernel

Nano-tier Layer-3 plugin. Gives route loaders the kernel's exact error messages at build. No
config, no state, no events, no lifecycle.

## Why a plugin

The messages are captured by running the real kernel through `createApp` / `createPlugin` from
`@moku-labs/web` (`src/lib/kernel-errors.ts`). That is the Node entry of the framework. A route
loader in `src/routes.tsx` is in the browser graph, and a lazy `import()` of a module that imports
the Node entry makes the client build fail. So the capture lives behind this plugin, composed only
in `src/app.ts`, and loaders reach it by name through `src/lib/kernel-reference.ts`.

## API (`app.kernel`)

| Member | Returns |
|---|---|
| `errors()` | Every kernel check with its exact message, in display order (`captureKernelErrors`) |
| `trayMessages(tray)` | The messages the hero tray can show, captured with the tray's own plugin names (`captureTrayMessages`) |

Every call runs the kernel again. A check that stops throwing fails the build.

## Used by

- The home route: the "kernel says no" cards and the hero tray (`src/lib/home-data.ts`).
