import { useEffect, useMemo, useState } from "react";
import type { DictationState } from "@echo/shared";
import { desktopApi, type AppStateSnapshot } from "./api/desktopApi";
import { HubLayout, type HubPage } from "./components/HubLayout";
import { Overlay, type OverlayState } from "./components/Overlay";
import { DictionaryPage } from "./pages/DictionaryPage";
import { HistoryPage } from "./pages/HistoryPage";
import { HomePage } from "./pages/HomePage";
import { SettingsPage } from "./pages/SettingsPage";
import type { DictionaryTermRow } from "../main/storage/dictionaryRepository";
import type { HistoryRow } from "../main/storage/historyRepository";
import type { EchoSettings } from "../main/storage/settingsRepository";
import "./styles.css";

const defaultSettings: EchoSettings = {
  historyRetention: "1_week",
  shortcut: "Alt+Space",
  language: "auto"
};

export function App() {
  const [page, setPage] = useState<HubPage>(location.hash === "#/overlay" ? "home" : "home");
  const [snapshot, setSnapshot] = useState<AppStateSnapshot>({ state: { status: "idle" }, settings: defaultSettings });
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [dictionary, setDictionary] = useState<DictionaryTermRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  const isOverlayRoute = location.hash === "#/overlay";

  useEffect(() => {
    void refresh();
    return desktopApi.onShortcutToggle(() => {
      void toggleDictation();
    });
  }, []);

  const overlayState = useMemo(() => buildOverlayState(snapshot.state, toggleDictation, cancelDictation, error), [snapshot.state, error]);

  if (isOverlayRoute) {
    return <Overlay state={overlayState} />;
  }

  return (
    <HubLayout activePage={page} onNavigate={setPage}>
      {error ? <div className="error-banner">{error}</div> : null}
      {page === "home" ? (
        <HomePage
          state={snapshot.state}
          settings={snapshot.settings}
          history={history}
          providerReady
          onToggle={() => void toggleDictation()}
        />
      ) : null}
      {page === "history" ? (
        <HistoryPage
          history={history}
          settings={snapshot.settings}
          onRetentionChange={(historyRetention) => void saveSettings({ historyRetention })}
          onCopy={(text) => void navigator.clipboard.writeText(text)}
          onDelete={(id) => void deleteHistoryRow(id)}
          onRetry={() => void toggleDictation()}
        />
      ) : null}
      {page === "dictionary" ? (
        <DictionaryPage terms={dictionary} onAdd={(term) => void addDictionaryTerm(term)} onDelete={(id) => void deleteDictionaryTerm(id)} />
      ) : null}
      {page === "settings" ? <SettingsPage settings={snapshot.settings} onSave={(settings) => void saveSettings(settings)} /> : null}
    </HubLayout>
  );

  async function refresh() {
    const [appState, rows, terms] = await Promise.all([
      desktopApi.getAppState(),
      desktopApi.listHistory(),
      desktopApi.listDictionaryTerms()
    ]);
    setSnapshot(appState);
    setHistory(rows);
    setDictionary(terms);
  }

  async function toggleDictation() {
    try {
      setError(null);
      const next =
        snapshot.state.status === "recording" || snapshot.state.status === "finalizing"
          ? await desktopApi.stopDictation()
          : await desktopApi.startDictation();
      setSnapshot(next);
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Dictation failed.");
    }
  }

  async function cancelDictation() {
    const next = await desktopApi.cancelDictation();
    setSnapshot(next);
  }

  async function saveSettings(settings: Partial<EchoSettings>) {
    const next = await desktopApi.saveSettings(settings);
    setSnapshot((current) => ({ ...current, settings: next }));
  }

  async function addDictionaryTerm(term: string) {
    await desktopApi.addDictionaryTerm({
      id: crypto.randomUUID(),
      term,
      aliases: [],
      case_sensitive: true,
      source: "manual",
      language: snapshot.settings.language
    });
    setDictionary(await desktopApi.listDictionaryTerms());
  }

  async function deleteDictionaryTerm(id: string) {
    await desktopApi.deleteDictionaryTerm(id);
    setDictionary(await desktopApi.listDictionaryTerms());
  }

  async function deleteHistoryRow(id: string) {
    await desktopApi.deleteHistoryRow(id);
    setHistory(await desktopApi.listHistory());
  }
}

function buildOverlayState(
  state: DictationState,
  onFinish: () => void,
  onCancel: () => void,
  error: string | null
): OverlayState {
  if (error) {
    return {
      status: "error",
      message: error,
      onRetry: onFinish,
      onCopy: () => void navigator.clipboard.writeText(error),
      onDismiss: onCancel
    };
  }

  if (state.status === "recording") {
    return {
      status: "recording",
      elapsedMs: 0,
      levelSamples: [0.2, 0.35, 0.5, 0.25],
      onCancel,
      onFinish
    };
  }
  if (state.status === "finalizing") {
    return { status: "finalizing" };
  }
  if (state.status === "processing") {
    return { status: "processing" };
  }
  if (state.status === "inserting") {
    return { status: "inserting" };
  }
  if (state.status === "complete") {
    return { status: "complete" };
  }
  if (state.status === "error") {
    return {
      status: "error",
      message: state.message,
      onRetry: onFinish,
      onCopy: () => void navigator.clipboard.writeText(state.message),
      onDismiss: onCancel
    };
  }
  return { status: "complete" };
}
