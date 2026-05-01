import { describe, expect, it, vi } from "vitest";
import { ipcMain } from "electron";

vi.mock("electron", () => ({
  ipcMain: {
    handle: vi.fn()
  }
}));

import { clearHistoryWithAudioCleanup, deleteHistoryRowWithAudioCleanup, registerIpcHandlers } from "./ipc";

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

describe("registerIpcHandlers", () => {
  it("exposes retained-recording history retry through IPC", () => {
    const retryHistoryRow = vi.fn();

    registerIpcHandlers({
      windows: { hubWindow: {} as never, overlayWindow: {} as never },
      repositories: {
        history: {
          listHistory: vi.fn(),
          deleteHistoryRow: vi.fn(),
          clearHistory: vi.fn()
        } as never,
        settings: {
          getSettings: vi.fn(),
          saveSettings: vi.fn()
        } as never,
        dictionary: {
          listDictionaryTerms: vi.fn(),
          addDictionaryTerm: vi.fn(),
          updateDictionaryTerm: vi.fn(),
          deleteDictionaryTerm: vi.fn()
        } as never
      },
      platform: {
        captureContext: vi.fn(),
        insertText: vi.fn(),
        getPermissionStatus: vi.fn(),
        requestMicrophonePermission: vi.fn(),
        requestAccessibilityPermission: vi.fn(),
        deleteLocalRecording: vi.fn()
      } as never,
      dictation: {
        getAppState: vi.fn(),
        startDictation: vi.fn(),
        stopDictation: vi.fn(),
        cancelDictation: vi.fn(),
        retryHistoryRow,
        getProviderStatus: vi.fn()
      }
    });

    expect(ipcMain.handle).toHaveBeenCalledWith("echo:retry-history-row", expect.any(Function));
  });
});
