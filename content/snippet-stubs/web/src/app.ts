import { buildPlugin, cliPlugin, createApp, deployPlugin } from "@moku-labs/web";
import { routes } from "./routes";
import { site } from "./site";

export const app = createApp({
  plugins: [buildPlugin, deployPlugin, cliPlugin],
  pluginConfigs: { site, router: { routes } }
});
