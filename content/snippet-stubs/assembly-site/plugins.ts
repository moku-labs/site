import { contentPlugin, createPlugin } from "@moku-labs/web";

/** Comments under each post: the hero's Site goal shows it needs `content`. */
export const commentsPlugin = createPlugin("comments", { depends: [contentPlugin] });

/** Email sign-up for new posts: the hero's Site goal shows it needs `site`. */
export const newsletterPlugin = createPlugin("newsletter", {});
