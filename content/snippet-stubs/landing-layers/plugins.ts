import { createCoreConfig } from "@moku-labs/core";

/** The sample's global config. */
export type Config = { title: string };

/** The sample's event map. */
export type Events = Record<string, never>;

const { createPlugin } = createCoreConfig<Config, Events>("my-site", { config: { title: "" } });

/** The default plugin the framework line bakes in. */
export const routerPlugin = createPlugin("router", {});

/** The plugin the app line adds. */
export const blogPlugin = createPlugin("blog", {});
