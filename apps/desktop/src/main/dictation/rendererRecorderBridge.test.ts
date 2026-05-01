import { describe, expect, it } from "vitest";
import { createRendererRecorderBridge } from "./rendererRecorderBridge";

function createFakeIpc() {
  const handlers = new Map<string, (event: unknown, payload: unknown) => unknown>();
  return {
    handle(channel: string, handler: (event: unknown, payload: unknown) => unknown) {
      handlers.set(channel, handler);
    },
    invoke(channel: string, payload: unknown) {
      const handler = handlers.get(channel);
      if (!handler) {
        throw new Error(`Missing handler ${channel}`);
      }
      return handler({}, payload);
    }
  };
}

describe("createRendererRecorderBridge", () => {
  it("sends renderer start request and resolves when recorder starts", async () => {
    const sent: Array<{ channel: string; payload: unknown }> = [];
    const ipc = createFakeIpc();
    const bridge = createRendererRecorderBridge({
      webContents: { send: (channel, payload) => sent.push({ channel, payload }) },
      ipcMain: ipc
    });

    const started = bridge.start("session-1");
    await ipc.invoke("echo:recorder-started", { sessionId: "session-1" });

    await expect(started).resolves.toBeUndefined();
    expect(sent).toEqual([{ channel: "echo:recorder-start", payload: { sessionId: "session-1" } }]);
  });

  it("returns renderer audio after stop", async () => {
    const sent: Array<{ channel: string; payload: unknown }> = [];
    const ipc = createFakeIpc();
    const bridge = createRendererRecorderBridge({
      webContents: { send: (channel, payload) => sent.push({ channel, payload }) },
      ipcMain: ipc
    });

    const stopped = bridge.stop("session-1");
    await ipc.invoke("echo:recorder-stopped", {
      sessionId: "session-1",
      audio: new Uint8Array([1, 2, 3]).buffer,
      audioFormat: "webm",
      durationMs: 1234,
      localPath: null
    });

    await expect(stopped).resolves.toMatchObject({
      audio: Buffer.from([1, 2, 3]),
      audioFormat: "webm",
      durationMs: 1234,
      localPath: null
    });
    expect(sent).toEqual([{ channel: "echo:recorder-stop", payload: { sessionId: "session-1" } }]);
  });
});
