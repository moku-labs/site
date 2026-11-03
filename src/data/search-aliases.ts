/**
 * @file The words visitors type for a term the docs spell another way. Plain data: the search
 * plugin copies it into the shard, and a build test fails when a target is not in the terms.
 */

/** Lower-case alias to the index terms it stands for. */
export const searchAliases: Readonly<Record<string, readonly string[]>> = {
  fx: ["effects"],
  sfx: ["audio", "sfx"],
  kv: ["kv", "storage"],
  db: ["d1", "database"],
  ws: ["websocket", "room"],
  i18n: ["i18n", "translation"],
  seo: ["head", "seo"],
  og: ["head", "seo"],
  ssg: ["build", "static"],
  spa: ["spa", "router"],
  route: ["route", "routing", "router"]
};
