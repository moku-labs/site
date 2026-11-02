import { createApp } from "@moku-labs/web";
import { describe, expect, expectTypeOf, it } from "vitest";
import { SITE } from "../../../../config";
import type { TrayMessages } from "../../../../lib/kernel-errors";
import { kernelPlugin } from "../..";

describe("kernel plugin", () => {
  // Bug: the plugin is not reachable on the app, or its API does not reach the real kernel.
  it("returns the real kernel's messages through the app", async () => {
    const app = createApp({ plugins: [kernelPlugin], pluginConfigs: { site: SITE } });

    const tray = await app.kernel.trayMessages([{ plugin: "blog" }, { plugin: "start" }]);

    expect(tray.duplicate.blog).toContain('"blog"');
    expect(tray.reserved.start).toContain('"start"');
  });

  it("types the public API for consumers", () => {
    const app = createApp({ plugins: [kernelPlugin], pluginConfigs: { site: SITE } });
    expectTypeOf(app.kernel.trayMessages).returns.toEqualTypeOf<Promise<TrayMessages>>();
    // @ts-expect-error trayMessages takes the tray's plugin list, not one plugin name
    expectTypeOf(app.kernel.trayMessages).toBeCallableWith("auth");
  });
});
