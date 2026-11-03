import { createPlugin, d1Plugin } from "@moku-labs/worker";

/** The task list API: the hero's App goal shows it needs `d1`. */
export const tasksPlugin = createPlugin("tasks", { depends: [d1Plugin] });
