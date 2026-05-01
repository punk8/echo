import { describe, expect, it, vi } from "vitest";

vi.mock("electron", () => ({
  ipcMain: {
    handle: vi.fn()
  }
}));

import { clearHistoryWithAudioCleanup, deleteHistoryRowWithAudioCleanup } from "./ipc";

describe("history IPC cleanup helpers", () => {
  it("deletes a history row and its local recording", async () => {
    const deleteLocalRecording = vi.fn().mockResolvedValue(undefined);
    const history = {
      deleteHistoryRow: vi.fn(() => ["/tmp/session-1.webm"])
    };

    await deleteHistoryRowWithAudioCleanup({ history, deleteLocalRecording }, "session-1");

    expect(history.deleteHistoryRow).toHaveBeenCalledWith("session-1");
    expect(deleteLocalRecording).toHaveBeenCalledWith("/tmp/session-1.webm");
  });

  it("clears history and all returned local recordings", async () => {
    const deleteLocalRecording = vi.fn().mockResolvedValue(undefined);
    const history = {
      clearHistory: vi.fn(() => ["/tmp/session-1.webm", "/tmp/session-2.webm"])
    };

    await clearHistoryWithAudioCleanup({ history, deleteLocalRecording });

    expect(history.clearHistory).toHaveBeenCalled();
    expect(deleteLocalRecording).toHaveBeenCalledWith("/tmp/session-1.webm");
    expect(deleteLocalRecording).toHaveBeenCalledWith("/tmp/session-2.webm");
  });
});
