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
  it("prunes history and recordings when retention settings change", async () => {
    vi.mocked(ipcMain.handle).mockClear();
    const deleteLocalRecording = vi.fn().mockResolvedValue(undefined);
    const history = {
      listHistory: vi.fn(),
      deleteHistoryRow: vi.fn(),
      clearHistory: vi.fn(),
      pruneHistory: vi.fn(() => ["/tmp/session-1.webm"])
    };
    const settings = {
      getSettings: vi.fn(() => ({
        historyRetention: "never",
        shortcut: "Alt+Space",
        language: "auto",
        microphoneDeviceId: "system",
        interactionSounds: true,
        muteOtherAudioWhileDictating: false,
        launchAtLogin: false,
        showDockIcon: true,
        outputStyle: "balanced"
      })),
      saveSettings: vi.fn()
    };

    registerIpcHandlers({
      windows: { hubWindow: {} as never, overlayWindow: {} as never },
      repositories: {
        history: history as never,
        settings: settings as never,
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
        deleteLocalRecording
      } as never,
      dictation: {
        getAppState: vi.fn(),
        startDictation: vi.fn(),
        stopDictation: vi.fn(),
        cancelDictation: vi.fn(),
        retryHistoryRow: vi.fn(),
        getProviderStatus: vi.fn()
      }
    });

    const saveSettingsHandler = vi
      .mocked(ipcMain.handle)
      .mock.calls.find(([channel]) => channel === "echo:save-settings")?.[1];

    await saveSettingsHandler?.({} as never, { historyRetention: "never" });

    expect(settings.saveSettings).toHaveBeenCalledWith({ historyRetention: "never" });
    expect(history.pruneHistory).toHaveBeenCalledWith("never");
    expect(deleteLocalRecording).toHaveBeenCalledWith("/tmp/session-1.webm");
  });

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
