import { ipcMain, type BrowserWindow } from "electron";
import type { DictationState } from "@echo/shared";
import type { captureContext } from "./platform/context";
import type { pasteTextWithClipboardFallback } from "./platform/insertion";
import type {
  getPermissionStatus,
  requestAccessibilityPermission,
  requestMicrophonePermission
} from "./platform/permissions";
import type { createDictionaryRepository } from "./storage/dictionaryRepository";
import type { createHistoryRepository } from "./storage/historyRepository";
import type { EchoSettings, createSettingsRepository } from "./storage/settingsRepository";

type HistoryRepository = ReturnType<typeof createHistoryRepository>;
type SettingsRepository = ReturnType<typeof createSettingsRepository>;
type DictionaryRepository = ReturnType<typeof createDictionaryRepository>;

export interface AppStateSnapshot {
  state: DictationState;
  settings: EchoSettings;
}

export interface RegisterIpcHandlersDeps {
  windows: {
    hubWindow: BrowserWindow;
    overlayWindow: BrowserWindow;
  };
  repositories: {
    history: HistoryRepository;
    settings: SettingsRepository;
    dictionary: DictionaryRepository;
  };
  platform: {
    captureContext: typeof captureContext;
    insertText: typeof pasteTextWithClipboardFallback;
    getPermissionStatus: typeof getPermissionStatus;
    requestMicrophonePermission: typeof requestMicrophonePermission;
    requestAccessibilityPermission: typeof requestAccessibilityPermission;
  };
  dictation: {
    getAppState: () => AppStateSnapshot;
    startDictation: () => Promise<AppStateSnapshot>;
    stopDictation: () => Promise<AppStateSnapshot>;
    cancelDictation: () => Promise<AppStateSnapshot>;
    getProviderStatus: () => Promise<unknown>;
  };
  onSettingsSaved?: (settings: EchoSettings) => void;
}

export function registerIpcHandlers(deps: RegisterIpcHandlersDeps) {
  ipcMain.handle("echo:get-app-state", () => deps.dictation.getAppState());
  ipcMain.handle("echo:start-dictation", () => deps.dictation.startDictation());
  ipcMain.handle("echo:stop-dictation", () => deps.dictation.stopDictation());
  ipcMain.handle("echo:cancel-dictation", () => deps.dictation.cancelDictation());
  ipcMain.handle("echo:get-provider-status", () => deps.dictation.getProviderStatus());
  ipcMain.handle("echo:capture-context", () => deps.platform.captureContext());
  ipcMain.handle("echo:get-permission-status", () => deps.platform.getPermissionStatus());
  ipcMain.handle("echo:request-microphone-permission", () => deps.platform.requestMicrophonePermission());
  ipcMain.handle("echo:request-accessibility-permission", () => deps.platform.requestAccessibilityPermission());

  ipcMain.handle("echo:list-history", () => deps.repositories.history.listHistory());
  ipcMain.handle("echo:delete-history-row", (_event, id: string) => {
    deps.repositories.history.deleteHistoryRow(id);
  });
  ipcMain.handle("echo:clear-history", () => {
    deps.repositories.history.clearHistory();
  });

  ipcMain.handle("echo:list-dictionary-terms", () => deps.repositories.dictionary.listDictionaryTerms());
  ipcMain.handle("echo:add-dictionary-term", (_event, term) => {
    deps.repositories.dictionary.addDictionaryTerm(term);
  });
  ipcMain.handle("echo:update-dictionary-term", (_event, term) => {
    deps.repositories.dictionary.updateDictionaryTerm(term);
  });
  ipcMain.handle("echo:delete-dictionary-term", (_event, id: string) => {
    deps.repositories.dictionary.deleteDictionaryTerm(id);
  });

  ipcMain.handle("echo:get-settings", () => deps.repositories.settings.getSettings());
  ipcMain.handle("echo:save-settings", (_event, settings: Partial<EchoSettings>) => {
    deps.repositories.settings.saveSettings(settings);
    const next = deps.repositories.settings.getSettings();
    deps.onSettingsSaved?.(next);
    return next;
  });

  ipcMain.handle("echo:show-overlay", () => {
    deps.windows.overlayWindow.showInactive();
  });
  ipcMain.handle("echo:hide-overlay", () => {
    deps.windows.overlayWindow.hide();
  });
}
