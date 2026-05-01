import { useEffect, useMemo, useRef, useState } from "react";
import type { DictationState } from "@echo/shared";
import { desktopApi, type AppStateSnapshot } from "./api/desktopApi";
import { HubLayout, type HubPage } from "./components/HubLayout";
import { Overlay, type OverlayState } from "./components/Overlay";
import { DictionaryPage } from "./pages/DictionaryPage";
import { HistoryPage } from "./pages/HistoryPage";
import { HomePage } from "./pages/HomePage";
import { SettingsPage } from "./pages/SettingsPage";
import type { DictionaryTermRow } from "../main/storage/dictionaryRepository";
import type { PermissionStatusSnapshot } from "../main/platform/permissions";
import type { HistoryRow } from "../main/storage/historyRepository";
import type { EchoSettings } from "../main/storage/settingsRepository";
import { createAudioRecorder, type AudioRecorder } from "./recording/audioRecorder";
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
  const [permissions, setPermissions] = useState<PermissionStatusSnapshot>({
    microphone: "unknown",
    accessibility: "denied"
  });
  const [error, setError] = useState<string | null>(null);
  const [overlayPayload, setOverlayPayload] = useState<MainOverlayPayload | null>(null);
  const [levelSamples, setLevelSamples] = useState<number[]>([0.16, 0.22, 0.18, 0.28]);
  const [recordingStartedAt, setRecordingStartedAt] = useState<number | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const snapshotRef = useRef(snapshot);
  const recorderRef = useRef<AudioRecorder | null>(null);

  const isOverlayRoute = location.hash === "#/overlay";

  useEffect(() => {
    snapshotRef.current = snapshot;
  }, [snapshot]);

  useEffect(() => {
    void refresh();
    const removeShortcut = desktopApi.onShortcutToggle(() => {
      void toggleDictation();
    });
    const removeRecorderStart = desktopApi.onRecorderStart(async () => {
      const recorder = createAudioRecorder({
        onLevel: (level) => {
          setLevelSamples((current) => [...current.slice(-17), level]);
        }
      });
      recorderRef.current = recorder;
      setRecordingStartedAt(performance.now());
      await recorder.start();
    });
    const removeRecorderStop = desktopApi.onRecorderStop(async () => {
      const recorder = recorderRef.current;
      if (!recorder) {
        throw new Error("audio.recorder_not_started");
      }
      const result = await recorder.stop();
      recorderRef.current = null;
      setRecordingStartedAt(null);
      return result;
    });
    const removeRecorderCancel = desktopApi.onRecorderCancel(() => {
      recorderRef.current?.cancel();
      recorderRef.current = null;
      setRecordingStartedAt(null);
    });
    const removeOverlayState = desktopApi.onOverlayState((payload) => {
      if (isMainOverlayPayload(payload)) {
        setOverlayPayload(payload);
        if (payload.status === "recording") {
          setRecordingStartedAt(performance.now());
        }
        if (payload.status === "complete" || payload.status === "error") {
          setRecordingStartedAt(null);
        }
      }
    });
    return () => {
      removeShortcut();
      removeRecorderStart();
      removeRecorderStop();
      removeRecorderCancel();
      removeOverlayState();
    };
  }, []);

  useEffect(() => {
    if (recordingStartedAt === null) {
      setElapsedMs(0);
      return;
    }
    const interval = window.setInterval(() => {
      setElapsedMs(Math.max(0, performance.now() - recordingStartedAt));
    }, 250);
    return () => window.clearInterval(interval);
  }, [recordingStartedAt]);

  const overlayState = useMemo(
    () => buildOverlayState(snapshot.state, overlayPayload, levelSamples, elapsedMs, toggleDictation, cancelDictation, error),
    [snapshot.state, overlayPayload, levelSamples, elapsedMs, error]
  );

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
          onClear={() => void clearHistory()}
        />
      ) : null}
      {page === "dictionary" ? (
        <DictionaryPage
          terms={dictionary}
          onAdd={(term, aliases) => void addDictionaryTerm(term, aliases)}
          onUpdate={(item) => void updateDictionaryTerm(item)}
          onDelete={(id) => void deleteDictionaryTerm(id)}
        />
      ) : null}
      {page === "settings" ? (
        <SettingsPage
          settings={snapshot.settings}
          permissions={permissions}
          onSave={(settings) => void saveSettings(settings)}
          onRestoreDefaultShortcut={() => void saveSettings({ shortcut: "Alt+Space" })}
          onRequestMicrophone={() => void requestMicrophonePermission()}
          onRequestAccessibility={() => void requestAccessibilityPermission()}
        />
      ) : null}
    </HubLayout>
  );

  async function refresh() {
    const [appState, rows, terms, permissionStatus] = await Promise.all([
      desktopApi.getAppState(),
      desktopApi.listHistory(),
      desktopApi.listDictionaryTerms(),
      desktopApi.getPermissionStatus()
    ]);
    setSnapshot(appState);
    setHistory(rows);
    setDictionary(terms);
    setPermissions(permissionStatus);
  }

  async function toggleDictation() {
    try {
      setError(null);
      const currentState = snapshotRef.current.state;
      const next =
        currentState.status === "recording" || currentState.status === "finalizing"
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

  async function addDictionaryTerm(term: string, aliases: string[]) {
    await desktopApi.addDictionaryTerm({
      id: crypto.randomUUID(),
      term,
      aliases,
      case_sensitive: true,
      source: "manual",
      language: snapshot.settings.language
    });
    setDictionary(await desktopApi.listDictionaryTerms());
  }

  async function updateDictionaryTerm(item: DictionaryTermRow) {
    await desktopApi.updateDictionaryTerm(item);
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

  async function clearHistory() {
    await desktopApi.clearHistory();
    setHistory([]);
  }

  async function requestMicrophonePermission() {
    setPermissions(await desktopApi.requestMicrophonePermission());
  }

  async function requestAccessibilityPermission() {
    setPermissions(await desktopApi.requestAccessibilityPermission());
  }
}

function buildOverlayState(
  state: DictationState,
  overlayPayload: MainOverlayPayload | null,
  levelSamples: number[],
  elapsedMs: number,
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

  if (overlayPayload?.status === "recording" || state.status === "recording") {
    return {
      status: "recording",
      elapsedMs,
      levelSamples,
      onCancel,
      onFinish
    };
  }
  if (overlayPayload?.status === "processing") {
    return { status: "processing" };
  }
  if (overlayPayload?.status === "complete") {
    return { status: "complete" };
  }
  if (overlayPayload?.status === "error") {
    const message = overlayPayload.message ?? "Dictation failed.";
    return {
      status: "error",
      message,
      onRetry: onFinish,
      onCopy: () => void navigator.clipboard.writeText(message),
      onDismiss: onCancel
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

interface MainOverlayPayload {
  status: "recording" | "processing" | "complete" | "error";
  sessionId: string;
  message?: string;
}

function isMainOverlayPayload(payload: unknown): payload is MainOverlayPayload {
  if (!payload || typeof payload !== "object") {
    return false;
  }
  const value = payload as { status?: unknown; sessionId?: unknown };
  return (
    typeof value.sessionId === "string" &&
    (value.status === "recording" || value.status === "processing" || value.status === "complete" || value.status === "error")
  );
}
