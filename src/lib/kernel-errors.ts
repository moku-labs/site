/**
 * @file Captures the kernel's real error messages by triggering each check.
 *
 * Build-time only. Every scenario runs `createApp` / `createPlugin` from `@moku-labs/web`
 * and records the exact `error.message`, so the site never retypes a kernel error.
 */
import { createApp, createPlugin } from "@moku-labs/web";
import { SITE } from "../config";

/** When a kernel check runs. */
export type KernelCheckPhase = "createPlugin" | "createApp" | "start";

/** One kernel check and the exact message it prints. */
export type KernelError = {
  /** Stable id, e.g. `duplicate-name`. */
  id: string;
  /** Phase the check runs in. */
  when: KernelCheckPhase;
  /** The exact message thrown by the kernel. */
  message: string;
  /** One-line fix shown next to the message. */
  hint: string;
};

/** One kernel check to trigger: everything of a `KernelError` but the message, plus the trigger. */
export type KernelScenario = Omit<KernelError, "message"> & {
  /** Runs the mistake. It must throw, or return a promise that rejects. */
  trigger: () => unknown;
};

/** Site identity every app needs; the `site` plugin refuses to init without it. */
const pluginConfigs = { site: SITE };

/** A plugin other plugins depend on. */
const authPlugin = createPlugin("auth", {});

/** A plugin that depends on `auth`. */
const billingPlugin = createPlugin("billing", { depends: [authPlugin] });

/**
 * Start an app twice; the second `start()` is the mistake.
 *
 * @returns Resolves when the app is stopped again.
 */
async function startTwice(): Promise<void> {
  const app = createApp({ pluginConfigs });
  await app.start();
  try {
    await app.start();
  } finally {
    await app.stop();
  }
}

/** The kernel checks in display order. */
const scenarios: readonly KernelScenario[] = [
  {
    id: "duplicate-name",
    when: "createApp",
    hint: "List each plugin once in createApp({ plugins }).",
    trigger: () => createApp({ plugins: [authPlugin, authPlugin], pluginConfigs })
  },
  {
    id: "missing-dependency",
    when: "createApp",
    hint: "Add the plugin it depends on to the plugins list.",
    trigger: () => createApp({ plugins: [billingPlugin], pluginConfigs })
  },
  {
    id: "dependency-order",
    when: "createApp",
    hint: "Put a dependency before the plugin that depends on it.",
    trigger: () => createApp({ plugins: [billingPlugin, authPlugin], pluginConfigs })
  },
  {
    id: "reserved-name",
    when: "createApp",
    hint: "Rename the plugin: start, stop, emit and require are app methods.",
    trigger: () => createApp({ plugins: [createPlugin("start", {})], pluginConfigs })
  },
  {
    id: "core-plugin-clash",
    when: "createApp",
    hint: "Rename the plugin: log and env are core plugins on every ctx.",
    trigger: () => createApp({ plugins: [createPlugin("log", {})], pluginConfigs })
  },
  {
    id: "events-object",
    when: "createPlugin",
    hint: "Declare events with a function: events: register => ({ ... }).",
    // @ts-expect-error -- the mistake under test: events given as an object.
    trigger: () => createPlugin("analytics", { events: {} })
  },
  {
    id: "double-start",
    when: "start",
    hint: "Call app.start() once per app.",
    trigger: startTwice
  }
];

/**
 * Run one scenario and return the message it throws.
 *
 * @param scenario - The kernel check to trigger.
 * @returns The exact `error.message`.
 * @throws {Error} When the scenario does not throw, or throws something that is not an Error.
 */
async function captureMessage(scenario: KernelScenario): Promise<string> {
  try {
    await scenario.trigger();
  } catch (error) {
    if (error instanceof Error) return error.message;
    throw new TypeError(
      `[site] kernel check "${scenario.id}" threw a value that is not an Error.\n  Fix the trigger in src/lib/kernel-errors.ts.`
    );
  }
  throw new Error(
    `[site] kernel check "${scenario.id}" no longer throws.\n  The kernel changed: update the scenario in src/lib/kernel-errors.ts.`
  );
}

/**
 * Trigger every kernel check and return the messages in display order.
 *
 * @param checks - The scenarios to run; the seven real kernel checks by default.
 * @returns One entry per check with the exact message the kernel threw.
 * @throws {Error} When a scenario no longer throws, which means the kernel changed.
 * @example
 * ```ts
 * // At build, for the checks section of the home page:
 * const errors = await captureKernelErrors();
 * errors[0]?.message; // '[web] Duplicate plugin name: "auth".\n  Each plugin must have a unique name.'
 * ```
 */
export async function captureKernelErrors(
  checks: readonly KernelScenario[] = scenarios
): Promise<KernelError[]> {
  const errors: KernelError[] = [];
  // One at a time: each scenario builds a whole app, and the order is the display order.
  for (const check of checks) {
    const message = await captureMessage(check);
    errors.push({ id: check.id, when: check.when, message, hint: check.hint });
  }
  return errors;
}

/** A hero tray plugin as the kernel sees it: its name and the plugin it depends on. */
export type TrayRule = {
  /** The plugin name. */
  plugin: string;
  /** Name of the plugin it depends on. */
  depends?: string;
};

/** The kernel's exact messages for the checks a tray plugin can fail, by plugin name. */
export type TrayMessages = {
  /** Registered twice; for every name that is not reserved. */
  duplicate: Record<string, string>;
  /** Its dependency is not registered; for every name with a dependency. */
  missing: Record<string, string>;
  /** A reserved app method name; only for those names. */
  reserved: Record<string, string>;
};

/**
 * The app's own method names (`start`, `stop`, `emit`, …): the names the kernel reserves.
 * Read from a real app, so the list follows the kernel.
 *
 * @returns The method names.
 */
function appMethodNames(): Set<string> {
  const app = createApp({ pluginConfigs });
  return new Set(
    Object.entries(app)
      .filter(([, member]) => typeof member === "function")
      .map(([name]) => name)
  );
}

/**
 * Capture the real kernel's message for every check the hero tray can fail, using the tray's
 * own plugin names, so the hero never retypes a kernel string. A reserved name gets only its
 * reserved message (the kernel checks that first); every other name gets its "registered twice"
 * message, and a name with a dependency also its "missing dependency" message.
 *
 * @param tray - The tray plugins; repeated names are captured once.
 * @returns The messages by check and plugin name.
 * @throws {Error} When a scenario no longer throws, which means the kernel changed.
 * @example
 * ```ts
 * // At build, for the hero's data-props:
 * const messages = await captureTrayMessages(trayPlugins);
 * messages.duplicate.router; // '[web] Duplicate plugin name: "router".\n  Each plugin must have a unique name.'
 * ```
 */
export async function captureTrayMessages(tray: readonly TrayRule[]): Promise<TrayMessages> {
  const methods = appMethodNames();
  const messages: TrayMessages = { duplicate: {}, missing: {}, reserved: {} };
  for (const name of new Set(tray.map(rule => rule.plugin))) {
    const dependsOn = tray.find(rule => rule.plugin === name && rule.depends)?.depends;
    const base = { when: "createApp", hint: "" } as const;
    if (methods.has(name)) {
      messages.reserved[name] = await captureMessage({
        ...base,
        id: `reserved-name:${name}`,
        trigger: () => createApp({ plugins: [createPlugin(name, {})], pluginConfigs })
      });
      continue;
    }
    // The dependency is registered first, so only the duplicate can fail.
    const dependency = dependsOn === undefined ? undefined : createPlugin(dependsOn, {});
    const own = () =>
      dependency === undefined
        ? createPlugin(name, {})
        : createPlugin(name, { depends: [dependency] });
    messages.duplicate[name] = await captureMessage({
      ...base,
      id: `duplicate-name:${name}`,
      trigger: () =>
        dependency === undefined
          ? createApp({ plugins: [own(), own()], pluginConfigs })
          : createApp({ plugins: [dependency, own(), own()], pluginConfigs })
    });
    if (dependsOn !== undefined) {
      const absent = createPlugin(dependsOn, {});
      messages.missing[name] = await captureMessage({
        ...base,
        id: `missing-dependency:${name}`,
        trigger: () =>
          createApp({ plugins: [createPlugin(name, { depends: [absent] })], pluginConfigs })
      });
    }
  }
  return messages;
}
