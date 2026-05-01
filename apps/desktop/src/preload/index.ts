import { contextBridge, ipcRenderer } from "electron";

const echoApi = {
  getAppState: () => ipcRenderer.invoke("echo:get-app-state"),
  startDictation: () => ipcRenderer.invoke("echo:start-dictation"),
  stopDictation: () => ipcRenderer.invoke("echo:stop-dictation"),
  cancelDictation: () => ipcRenderer.invoke("echo:cancel-dictation"),
  captureContext: () => ipcRenderer.invoke("echo:capture-context"),
  listHistory: () => ipcRenderer.invoke("echo:list-history"),
  deleteHistoryRow: (id: string) => ipcRenderer.invoke("echo:delete-history-row", id),
  clearHistory: () => ipcRenderer.invoke("echo:clear-history"),
  listDictionaryTerms: () => ipcRenderer.invoke("echo:list-dictionary-terms"),
  addDictionaryTerm: (term: unknown) => ipcRenderer.invoke("echo:add-dictionary-term", term),
  updateDictionaryTerm: (term: unknown) => ipcRenderer.invoke("echo:update-dictionary-term", term),
  deleteDictionaryTerm: (id: string) => ipcRenderer.invoke("echo:delete-dictionary-term", id),
  getSettings: () => ipcRenderer.invoke("echo:get-settings"),
  saveSettings: (settings: unknown) => ipcRenderer.invoke("echo:save-settings", settings),
  showOverlay: () => ipcRenderer.invoke("echo:show-overlay"),
  hideOverlay: () => ipcRenderer.invoke("echo:hide-overlay"),
  onShortcutToggle: (callback: () => void) => {
    const listener = () => callback();
    ipcRenderer.on("echo:shortcut-toggle", listener);
    return () => ipcRenderer.removeListener("echo:shortcut-toggle", listener);
  },
  onShortcutError: (callback: (payload: unknown) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, payload: unknown) => callback(payload);
    ipcRenderer.on("echo:shortcut-error", listener);
    return () => ipcRenderer.removeListener("echo:shortcut-error", listener);
  },
  onRecorderStart: (callback: (payload: { sessionId: string }) => Promise<void>) => {
    const listener = async (_event: Electron.IpcRendererEvent, payload: { sessionId: string }) => {
      try {
        await callback(payload);
        await ipcRenderer.invoke("echo:recorder-started", payload);
      } catch (error) {
        await ipcRenderer.invoke("echo:recorder-failed", {
          sessionId: payload.sessionId,
          message: error instanceof Error ? error.message : "audio.recorder_failed"
        });
      }
    };
    ipcRenderer.on("echo:recorder-start", listener);
    return () => ipcRenderer.removeListener("echo:recorder-start", listener);
  },
  onRecorderStop: (
    callback: (payload: { sessionId: string }) => Promise<{ blob: Blob; audioFormat: "webm" | "wav"; durationMs: number }>
  ) => {
    const listener = async (_event: Electron.IpcRendererEvent, payload: { sessionId: string }) => {
      try {
        const result = await callback(payload);
        await ipcRenderer.invoke("echo:recorder-stopped", {
          sessionId: payload.sessionId,
          audio: await result.blob.arrayBuffer(),
          audioFormat: result.audioFormat,
          durationMs: result.durationMs,
          localPath: null
        });
      } catch (error) {
        await ipcRenderer.invoke("echo:recorder-failed", {
          sessionId: payload.sessionId,
          message: error instanceof Error ? error.message : "audio.recorder_failed"
        });
      }
    };
    ipcRenderer.on("echo:recorder-stop", listener);
    return () => ipcRenderer.removeListener("echo:recorder-stop", listener);
  },
  onRecorderCancel: (callback: (payload: { sessionId: string }) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, payload: { sessionId: string }) => callback(payload);
    ipcRenderer.on("echo:recorder-cancel", listener);
    return () => ipcRenderer.removeListener("echo:recorder-cancel", listener);
  },
  onOverlayState: (callback: (payload: unknown) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, payload: unknown) => callback(payload);
    ipcRenderer.on("echo:overlay-state", listener);
    return () => ipcRenderer.removeListener("echo:overlay-state", listener);
  }
};

contextBridge.exposeInMainWorld("echo", echoApi);

export type EchoApi = typeof echoApi;
