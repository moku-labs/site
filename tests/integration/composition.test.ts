import {
  buildPlugin,
  collectionPlugin,
  contentPlugin,
  createApp,
  fileSystemContent
} from "@moku-labs/web";
import { describe, expect, it } from "vitest";
import { SITE } from "../../src/config";
import { docsPlugin } from "../../src/plugins/docs";
import { llmsPlugin } from "../../src/plugins/llms";
import { searchPlugin } from "../../src/plugins/search";

// Catches: a custom plugin whose `depends` names a framework plugin missing from the
// composition, or listed after it. The kernel refuses that at createApp.
describe("custom plugin composition", () => {
  it("composes docs, search and llms on top of content, collection and build", () => {
    const app = createApp({
      plugins: [contentPlugin, collectionPlugin, buildPlugin, docsPlugin, searchPlugin, llmsPlugin],
      pluginConfigs: {
        site: SITE,
        content: { providers: [fileSystemContent({ contentDir: "content/articles" })] }
      }
    });

    expect(typeof app.docs.get).toBe("function");
    expect(typeof app.search.write).toBe("function");
    expect(typeof app.llms.emit).toBe("function");
  });
});
