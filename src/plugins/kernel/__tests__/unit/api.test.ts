import { describe, expect, it, vi } from "vitest";
import { createKernelApi } from "../../api";

const capture = vi.hoisted(() => ({
  captureTrayMessages: vi.fn(async () => ({ duplicate: {}, missing: {}, reserved: {} }))
}));
vi.mock("../../../../lib/kernel-errors", () => capture);

describe("kernel api", () => {
  // Bug: the tray argument is dropped, and the hero shows messages with plugin names the tray
  // does not have.
  it("trayMessages() captures with the tray it is given", async () => {
    const tray = [{ plugin: "auth", depends: "session" }];

    const messages = await createKernelApi().trayMessages(tray);

    expect(capture.captureTrayMessages).toHaveBeenCalledWith(tray);
    expect(messages).toEqual({ duplicate: {}, missing: {}, reserved: {} });
  });
});
