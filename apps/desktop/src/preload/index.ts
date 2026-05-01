import { contextBridge, ipcRenderer } from "electron";

const echoApi = {
  getAppState: () => ipcRenderer.invoke("echo:get-app-state"),
  startDictation: () => ipcRenderer.invoke("echo:start-dictation"),
  stopDictation: () => ipcRenderer.invoke("echo:stop-dictation"),
  cancelDictation: () => ipcRenderer.invoke("echo:cancel-dictation"),
  captureContext: () => ipcRenderer.invoke("echo:capture-context"),
  listHistory: () => ipcRenderer.invoke("echo:list-history"),
  deleteHistoryRow: (id: string) => ipcRenderer.invoke("echo:delete-history-row", id),
  listDictionaryTerms: () => ipcRenderer.invoke("echo:list-dictionary-terms"),
  addDictionaryTerm: (term: unknown) => ipcRenderer.invoke("echo:add-dictionary-term", term),
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
  }
};

contextBridge.exposeInMainWorld("echo", echoApi);

export type EchoApi = typeof echoApi;
