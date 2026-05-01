import type { DictationState } from "@echo/shared";
import type { DictionaryTermInput, DictionaryTermRow } from "../../main/storage/dictionaryRepository";
import type { HistoryRow } from "../../main/storage/historyRepository";
import type { EchoSettings } from "../../main/storage/settingsRepository";
import type { AudioRecorderResult } from "../recording/audioRecorder";
import type { PermissionStatusSnapshot } from "../../main/platform/permissions";
import type { ProviderStatus } from "../../main/dictation/providerStatus";

export interface AppStateSnapshot {
  state: DictationState;
  settings: EchoSettings;
}

export const desktopApi = {
  getAppState: () => window.echo.getAppState() as Promise<AppStateSnapshot>,
  startDictation: () => window.echo.startDictation() as Promise<AppStateSnapshot>,
  stopDictation: () => window.echo.stopDictation() as Promise<AppStateSnapshot>,
  cancelDictation: () => window.echo.cancelDictation() as Promise<AppStateSnapshot>,
  retryHistoryRow: (id: string) => window.echo.retryHistoryRow(id) as Promise<AppStateSnapshot>,
  getProviderStatus: () => window.echo.getProviderStatus() as Promise<ProviderStatus>,
  listHistory: () => window.echo.listHistory() as Promise<HistoryRow[]>,
  deleteHistoryRow: (id: string) => window.echo.deleteHistoryRow(id) as Promise<void>,
  clearHistory: () => window.echo.clearHistory() as Promise<void>,
  listDictionaryTerms: () => window.echo.listDictionaryTerms() as Promise<DictionaryTermRow[]>,
  addDictionaryTerm: (term: DictionaryTermInput) => window.echo.addDictionaryTerm(term) as Promise<void>,
  updateDictionaryTerm: (term: DictionaryTermInput) => window.echo.updateDictionaryTerm(term) as Promise<void>,
  deleteDictionaryTerm: (id: string) => window.echo.deleteDictionaryTerm(id) as Promise<void>,
  getSettings: () => window.echo.getSettings() as Promise<EchoSettings>,
  saveSettings: (settings: Partial<EchoSettings>) => window.echo.saveSettings(settings) as Promise<EchoSettings>,
  getPermissionStatus: () => window.echo.getPermissionStatus() as Promise<PermissionStatusSnapshot>,
  requestMicrophonePermission: () => window.echo.requestMicrophonePermission() as Promise<PermissionStatusSnapshot>,
  requestAccessibilityPermission: () => window.echo.requestAccessibilityPermission() as Promise<PermissionStatusSnapshot>,
  hideOverlay: () => window.echo.hideOverlay() as Promise<void>,
  onShortcutToggle: (callback: () => void) => window.echo.onShortcutToggle(callback),
  onShortcutError: (callback: (payload: unknown) => void) => window.echo.onShortcutError(callback),
  onRecorderStart: (callback: (payload: { sessionId: string }) => Promise<void>) => window.echo.onRecorderStart(callback),
  onRecorderStop: (callback: (payload: { sessionId: string }) => Promise<AudioRecorderResult>) => window.echo.onRecorderStop(callback),
  onRecorderCancel: (callback: (payload: { sessionId: string }) => void) => window.echo.onRecorderCancel(callback),
  onOverlayState: (callback: (payload: unknown) => void) => window.echo.onOverlayState(callback)
};

declare global {
  interface Window {
    echo: {
      getAppState: () => Promise<unknown>;
      startDictation: () => Promise<unknown>;
      stopDictation: () => Promise<unknown>;
      cancelDictation: () => Promise<unknown>;
      retryHistoryRow: (id: string) => Promise<unknown>;
      getProviderStatus: () => Promise<unknown>;
      listHistory: () => Promise<unknown>;
      deleteHistoryRow: (id: string) => Promise<unknown>;
      clearHistory: () => Promise<unknown>;
      listDictionaryTerms: () => Promise<unknown>;
      addDictionaryTerm: (term: unknown) => Promise<unknown>;
      updateDictionaryTerm: (term: unknown) => Promise<unknown>;
      deleteDictionaryTerm: (id: string) => Promise<unknown>;
      getSettings: () => Promise<unknown>;
      saveSettings: (settings: unknown) => Promise<unknown>;
      getPermissionStatus: () => Promise<unknown>;
      requestMicrophonePermission: () => Promise<unknown>;
      requestAccessibilityPermission: () => Promise<unknown>;
      hideOverlay: () => Promise<unknown>;
      onShortcutToggle: (callback: () => void) => () => void;
      onShortcutError: (callback: (payload: unknown) => void) => () => void;
      onRecorderStart: (callback: (payload: { sessionId: string }) => Promise<void>) => () => void;
      onRecorderStop: (callback: (payload: { sessionId: string }) => Promise<AudioRecorderResult>) => () => void;
      onRecorderCancel: (callback: (payload: { sessionId: string }) => void) => () => void;
      onOverlayState: (callback: (payload: unknown) => void) => () => void;
    };
  }
}
