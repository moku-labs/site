import { defineRoutes, route } from "@moku-labs/web/browser";

export const routes = defineRoutes({
  home: route("/").render(() => <h1>Home</h1>)
});
