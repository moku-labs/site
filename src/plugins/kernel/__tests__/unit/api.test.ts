import { describe, expect, it, vi } from "vitest";
import { createKernelApi } from "../../api";

const capture = vi.hoisted(() => ({
  captureKernelErrors: vi.fn(async () => [
    { id: "duplicate-name", when: "createApp", message: "[web] Duplicate.", hint: "Rename." }
  ]),
  captureTrayMessages: vi.fn(async () => ({ duplicate: {}, missing: {}, reserved: {} }))
}));
vi.mock("../../../../lib/kernel-errors", () => capture);

describe("kernel api", () => {
  // Bug: the API keeps the first capture, so a dev rebuild after a core bump shows the messages of
  // the kernel that was installed when the process started.
  it("errors() runs the kernel capture on every call", async () => {
    const api = createKernelApi();

    await api.errors();
    const errors = await api.errors();

    expect(capture.captureKernelErrors).toHaveBeenCalledTimes(2);
    expect(errors.map(error => error.id)).toEqual(["duplicate-name"]);
  });

  // Bug: the tray argument is dropped, and the hero shows messages with plugin names the tray
  // does not have.
  it("trayMessages() captures with the tray it is given", async () => {
    const tray = [{ plugin: "auth", depends: "session" }];

    const messages = await createKernelApi().trayMessages(tray);

    expect(capture.captureTrayMessages).toHaveBeenCalledWith(tray);
    expect(messages).toEqual({ duplicate: {}, missing: {}, reserved: {} });
  });
});
