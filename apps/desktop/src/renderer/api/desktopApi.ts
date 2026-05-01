import type { DictationState } from "@echo/shared";
import type { DictionaryTermInput, DictionaryTermRow } from "../../main/storage/dictionaryRepository";
import type { HistoryRow } from "../../main/storage/historyRepository";
import type { EchoSettings } from "../../main/storage/settingsRepository";

export interface AppStateSnapshot {
  state: DictationState;
  settings: EchoSettings;
}

export const desktopApi = {
  getAppState: () => window.echo.getAppState() as Promise<AppStateSnapshot>,
  startDictation: () => window.echo.startDictation() as Promise<AppStateSnapshot>,
  stopDictation: () => window.echo.stopDictation() as Promise<AppStateSnapshot>,
  cancelDictation: () => window.echo.cancelDictation() as Promise<AppStateSnapshot>,
  listHistory: () => window.echo.listHistory() as Promise<HistoryRow[]>,
  deleteHistoryRow: (id: string) => window.echo.deleteHistoryRow(id) as Promise<void>,
  listDictionaryTerms: () => window.echo.listDictionaryTerms() as Promise<DictionaryTermRow[]>,
  addDictionaryTerm: (term: DictionaryTermInput) => window.echo.addDictionaryTerm(term) as Promise<void>,
  deleteDictionaryTerm: (id: string) => window.echo.deleteDictionaryTerm(id) as Promise<void>,
  getSettings: () => window.echo.getSettings() as Promise<EchoSettings>,
  saveSettings: (settings: Partial<EchoSettings>) => window.echo.saveSettings(settings) as Promise<EchoSettings>,
  onShortcutToggle: (callback: () => void) => window.echo.onShortcutToggle(callback),
  onShortcutError: (callback: (payload: unknown) => void) => window.echo.onShortcutError(callback)
};

declare global {
  interface Window {
    echo: {
      getAppState: () => Promise<unknown>;
      startDictation: () => Promise<unknown>;
      stopDictation: () => Promise<unknown>;
      cancelDictation: () => Promise<unknown>;
      listHistory: () => Promise<unknown>;
      deleteHistoryRow: (id: string) => Promise<unknown>;
      listDictionaryTerms: () => Promise<unknown>;
      addDictionaryTerm: (term: unknown) => Promise<unknown>;
      deleteDictionaryTerm: (id: string) => Promise<unknown>;
      getSettings: () => Promise<unknown>;
      saveSettings: (settings: unknown) => Promise<unknown>;
      onShortcutToggle: (callback: () => void) => () => void;
      onShortcutError: (callback: (payload: unknown) => void) => () => void;
    };
  }
}
