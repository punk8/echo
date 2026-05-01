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
import type { ProviderStatus } from "../main/dictation/providerStatus";
import type { HistoryRow } from "../main/storage/historyRepository";
import type { EchoSettings } from "../main/storage/settingsRepository";
import { listMicrophoneDevices, type MicrophoneDevice } from "./recording/audioDevices";
import { createAudioRecorder, type AudioRecorder } from "./recording/audioRecorder";
import { formatShortcutError } from "./shortcutErrors";
import "./styles.css";

const defaultSettings: EchoSettings = {
  historyRetention: "1_week",
  shortcut: "Alt+Space",
  language: "auto",
  microphoneDeviceId: "system",
  interactionSounds: true,
  muteOtherAudioWhileDictating: false,
  launchAtLogin: false,
  showDockIcon: true,
  outputStyle: "balanced"
};

export function App() {
  const [page, setPage] = useState<HubPage>("home");
  const [snapshot, setSnapshot] = useState<AppStateSnapshot>({ state: { status: "idle" }, settings: defaultSettings });
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [dictionary, setDictionary] = useState<DictionaryTermRow[]>([]);
  const [microphoneDevices, setMicrophoneDevices] = useState<MicrophoneDevice[]>([
    { id: "system", label: "System default" }
  ]);
  const [permissions, setPermissions] = useState<PermissionStatusSnapshot>({
    microphone: "unknown",
    accessibility: "denied"
  });
  const [providerStatus, setProviderStatus] = useState<ProviderStatus>({
    reachable: false,
    apiBaseUrl: "http://127.0.0.1:43110"
  });
  const [error, setError] = useState<string | null>(null);
  const [overlayPayload, setOverlayPayload] = useState<MainOverlayPayload | null>(null);
  const [levelSamples, setLevelSamples] = useState<number[]>([0.16, 0.22, 0.18, 0.28]);
  const [recordingStartedAt, setRecordingStartedAt] = useState<number | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const snapshotRef = useRef(snapshot);
  const recorderRef = useRef<AudioRecorder | null>(null);

  const isOverlayRoute = isOverlayRouteHash(location.hash);

  useEffect(() => {
    snapshotRef.current = snapshot;
  }, [snapshot]);

  useEffect(() => {
    void refresh();
    const removeShortcut = desktopApi.onShortcutToggle(() => {
      void toggleDictation();
    });
    const removeShortcutError = desktopApi.onShortcutError((payload) => {
      setError(formatShortcutError(payload));
    });
    const removeRecorderStart = desktopApi.onRecorderStart(async () => {
      const recorder = createAudioRecorder({
        deviceId: snapshotRef.current.settings.microphoneDeviceId,
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
        if (payload.status === "finalizing" || payload.status === "complete" || payload.status === "error") {
          setRecordingStartedAt(null);
        }
      }
    });
    return () => {
      removeShortcut();
      removeShortcutError();
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
    () =>
      buildOverlayState(
        snapshot.state,
        overlayPayload,
        levelSamples,
        elapsedMs,
        toggleDictation,
        cancelDictation,
        error,
        undefined,
        dismissOverlay,
        retryHistoryRow,
        resolvePermissionError
      ),
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
          providerStatus={providerStatus}
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
          onRetry={(id) => void retryHistoryRow(id)}
          onClear={() => void clearHistory()}
        />
      ) : null}
      {page === "dictionary" ? (
        <DictionaryPage
          terms={dictionary}
          defaultLanguage={snapshot.settings.language}
          onAdd={(term, aliases, pronunciationHint, capitalization, language) =>
            void addDictionaryTerm(term, aliases, pronunciationHint, capitalization, language)
          }
          onUpdate={(item) => void updateDictionaryTerm(item)}
          onDelete={(id) => void deleteDictionaryTerm(id)}
        />
      ) : null}
      {page === "settings" ? (
        <SettingsPage
          settings={snapshot.settings}
          providerStatus={providerStatus}
          microphoneDevices={microphoneDevices}
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
    const [appState, rows, terms, permissionStatus, provider, devices] = await Promise.all([
      desktopApi.getAppState(),
      desktopApi.listHistory(),
      desktopApi.listDictionaryTerms(),
      desktopApi.getPermissionStatus(),
      desktopApi.getProviderStatus(),
      listMicrophoneDevices()
    ]);
    setSnapshot(appState);
    setHistory(rows);
    setDictionary(terms);
    setPermissions(permissionStatus);
    setProviderStatus(provider);
    setMicrophoneDevices(devices);
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

  async function dismissOverlay() {
    setError(null);
    setOverlayPayload(null);
    await desktopApi.hideOverlay();
  }

  async function saveSettings(settings: Partial<EchoSettings>) {
    const next = await desktopApi.saveSettings(settings);
    setSnapshot((current) => ({ ...current, settings: next }));
  }

  async function addDictionaryTerm(
    term: string,
    aliases: string[],
    pronunciationHint: string | null,
    capitalization: string | null,
    language: string
  ) {
    await desktopApi.addDictionaryTerm({
      id: crypto.randomUUID(),
      term,
      aliases,
      case_sensitive: true,
      source: "manual",
      language,
      pronunciation_hint: pronunciationHint,
      capitalization
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

  async function retryHistoryRow(id: string) {
    try {
      setError(null);
      const next = await desktopApi.retryHistoryRow(id);
      setSnapshot(next);
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "History retry failed.");
    }
  }

  async function requestMicrophonePermission() {
    setPermissions(await desktopApi.requestMicrophonePermission());
    setMicrophoneDevices(await listMicrophoneDevices());
  }

  async function requestAccessibilityPermission() {
    setPermissions(await desktopApi.requestAccessibilityPermission());
  }

  async function resolvePermissionError(code: string) {
    if (code === "permission.microphone_missing") {
      await requestMicrophonePermission();
      return;
    }
    if (code === "permission.accessibility_missing") {
      await requestAccessibilityPermission();
    }
  }
}

export function isOverlayRouteHash(hash: string) {
  return hash === "#overlay" || hash === "#/overlay";
}

export function buildOverlayState(
  state: DictationState,
  overlayPayload: MainOverlayPayload | null,
  levelSamples: number[],
  elapsedMs: number,
  onFinish: () => void,
  onCancel: () => void,
  error: string | null,
  writeClipboard: (text: string) => void | Promise<void> = (text) => navigator.clipboard.writeText(text),
  onDismiss: () => void = onCancel,
  onRetryHistory: (historyId: string) => void | Promise<void> = () => onFinish(),
  onResolvePermission: (code: string) => void | Promise<void> = () => undefined
): OverlayState {
  if (error) {
    return {
      status: "error",
      message: error,
      onRetry: onFinish,
      onCopy: () => void writeClipboard(error),
      onDismiss
    };
  }

  if (overlayPayload?.status === "finalizing") {
    return { status: "finalizing" };
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
  if (overlayPayload?.status === "inserting") {
    return { status: "inserting" };
  }
  if (overlayPayload?.status === "copied") {
    return { status: "copied" };
  }
  if (overlayPayload?.status === "complete") {
    return { status: "complete" };
  }
  if (overlayPayload?.status === "error") {
    const message = overlayPayload.message ?? "Dictation failed.";
    const copyText = overlayPayload.recoverableText ?? message;
    const retryHistoryId = overlayPayload.retryHistoryId;
    const recoveryActionLabel = permissionRecoveryActionLabel(overlayPayload.code);
    return {
      status: "error",
      message,
      ...(overlayPayload.recoverableText ? { recoverableText: overlayPayload.recoverableText } : {}),
      ...(recoveryActionLabel && overlayPayload.code
        ? {
            recoveryActionLabel,
            onRecoveryAction: () => void onResolvePermission(overlayPayload.code as string)
          }
        : {}),
      onRetry: retryHistoryId ? () => void onRetryHistory(retryHistoryId) : onFinish,
      onCopy: () => void writeClipboard(copyText),
      onDismiss
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
    const recoveryActionLabel = permissionRecoveryActionLabel(state.code);
    return {
      status: "error",
      message: state.message,
      ...(recoveryActionLabel
        ? {
            recoveryActionLabel,
            onRecoveryAction: () => void onResolvePermission(state.code)
          }
        : {}),
      onRetry: onFinish,
      onCopy: () => void writeClipboard(state.message),
      onDismiss
    };
  }
  return { status: "complete" };
}

export interface MainOverlayPayload {
  status: "recording" | "finalizing" | "processing" | "inserting" | "copied" | "complete" | "error";
  sessionId: string;
  message?: string;
  code?: string;
  recoverableText?: string;
  retryHistoryId?: string;
}

export function isMainOverlayPayload(payload: unknown): payload is MainOverlayPayload {
  if (!payload || typeof payload !== "object") {
    return false;
  }
  const value = payload as {
    status?: unknown;
    sessionId?: unknown;
    message?: unknown;
    code?: unknown;
    recoverableText?: unknown;
    retryHistoryId?: unknown;
  };
  return (
    typeof value.sessionId === "string" &&
    (value.message === undefined || typeof value.message === "string") &&
    (value.code === undefined || typeof value.code === "string") &&
    (value.recoverableText === undefined || typeof value.recoverableText === "string") &&
    (value.retryHistoryId === undefined || typeof value.retryHistoryId === "string") &&
    (value.status === "recording" ||
      value.status === "finalizing" ||
      value.status === "processing" ||
      value.status === "inserting" ||
      value.status === "copied" ||
      value.status === "complete" ||
      value.status === "error")
  );
}

function permissionRecoveryActionLabel(code: string | undefined) {
  if (code === "permission.accessibility_missing") {
    return "Open Accessibility Settings";
  }
  if (code === "permission.microphone_missing") {
    return "Open Microphone Settings";
  }
  return undefined;
}
