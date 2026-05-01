import {
  applyDictationEvent,
  type AudioFormat,
  type DictationContext,
  type DictationPreferences,
  type DictationState,
  type DictationSuccessResponse,
  type DictionaryTerm
} from "@echo/shared";
import { BackendDictationError, type ProcessDictationInput } from "./backendClient";
import type { InsertionResult } from "../platform/insertion";
import type { DictionaryTermRow } from "../storage/dictionaryRepository";
import type { HistoryRowInput } from "../storage/historyRepository";
import type { EchoSettings } from "../storage/settingsRepository";

export interface RecordedAudio {
  audio: Buffer;
  audioFormat: AudioFormat;
  durationMs: number;
  localPath: string | null;
}

export interface DictationSessionControllerDeps {
  createSessionId: () => string;
  now: () => string;
  captureContext: () => Promise<DictationContext>;
  recorder: {
    start: (sessionId: string) => Promise<void>;
    stop: (sessionId: string) => Promise<RecordedAudio>;
    cancel: (sessionId: string) => Promise<void>;
  };
  backend: (input: Omit<ProcessDictationInput, "apiBaseUrl" | "fetchImpl">) => Promise<DictationSuccessResponse>;
  insertText: (text: string) => Promise<InsertionResult>;
  copyText: (text: string) => Promise<InsertionResult>;
  overlay: {
    showRecording: (input: { sessionId: string; context: DictationContext }) => void;
    showProcessing: (input: { sessionId: string }) => void;
    showInserting: (input: { sessionId: string }) => void;
    showCopied: (input: { sessionId: string }) => void;
    showError: (input: { sessionId: string; code: string; message: string; recoverableText?: string }) => void;
    showComplete: (input: { sessionId: string }) => void;
    hide: () => void;
  };
  repositories: {
    history: {
      insertHistoryRow: (row: HistoryRowInput) => void;
      updateInsertionStatus: (id: string, insertionStatus: string) => void;
      pruneHistory: (retention: EchoSettings["historyRetention"]) => void;
    };
    dictionary: {
      listDictionaryTerms: () => DictionaryTermRow[];
    };
    settings: {
      getSettings: () => EchoSettings;
    };
  };
}

interface CurrentSession {
  sessionId: string;
  context: DictationContext;
  startedAt: string;
}

export function createDictationSessionController(deps: DictationSessionControllerDeps) {
  let state: DictationState = { status: "idle" };
  let currentSession: CurrentSession | undefined;

  return {
    getAppState,
    startDictation,
    stopDictation,
    cancelDictation
  };

  function getAppState() {
    return {
      state,
      settings: deps.repositories.settings.getSettings()
    };
  }

  async function startDictation() {
    state = applyDictationEvent(state, { type: "prepare" });
    const sessionId = deps.createSessionId();
    const context = await deps.captureContext();

    if (!context.writable) {
      const code = "target.no_writable_field";
      const message = "Focus a writable text field before starting dictation.";
      state = {
        status: "error",
        sessionId,
        code,
        message
      };
      deps.overlay.showError({ sessionId, code, message });
      return getAppState();
    }

    currentSession = {
      sessionId,
      context,
      startedAt: deps.now()
    };

    try {
      await deps.recorder.start(sessionId);
    } catch (error) {
      const recorderError = normalizeRecorderStartError(error);
      state = {
        status: "error",
        sessionId,
        code: recorderError.code,
        message: recorderError.message
      };
      currentSession = undefined;
      deps.overlay.showError({ sessionId, code: recorderError.code, message: recorderError.message });
      return getAppState();
    }

    state = applyDictationEvent(state, { type: "recording_started", sessionId });
    deps.overlay.showRecording({ sessionId, context });

    return getAppState();
  }

  async function stopDictation() {
    const session = requireCurrentSession();
    state = applyDictationEvent(state, { type: "stop_requested" });

    let recording: RecordedAudio;
    try {
      recording = await deps.recorder.stop(session.sessionId);
    } catch (error) {
      const recorderError = normalizeRecorderStopError(error);
      state = {
        status: "error",
        sessionId: session.sessionId,
        code: recorderError.code,
        message: recorderError.message
      };
      currentSession = undefined;
      deps.overlay.showError({ sessionId: session.sessionId, code: recorderError.code, message: recorderError.message });
      return getAppState();
    }

    state = applyDictationEvent(state, { type: "processing_started" });
    deps.overlay.showProcessing({ sessionId: session.sessionId });

    try {
      const settings = deps.repositories.settings.getSettings();
      const response = await deps.backend({
        sessionId: session.sessionId,
        audio: recording.audio,
        audioFormat: recording.audioFormat,
        durationMs: recording.durationMs,
        language: settings.language,
        context: session.context,
        dictionary: getDictionaryTerms(),
        preferences: getPreferences(settings)
      });

      state = applyDictationEvent(state, { type: "insert_started" });
      deps.overlay.showInserting({ sessionId: session.sessionId });
      const currentContext = await deps.captureContext();
      const insertion = isSameInsertionTarget(session.context, currentContext)
        ? await deps.insertText(response.refined_text)
        : await deps.copyText(response.refined_text);

      storeHistory(settings, buildCompletedHistoryRow({ session, recording, response, insertion }));

      state = applyDictationEvent(state, { type: "completed" });
      if (insertion.status === "copied") {
        deps.overlay.showCopied({ sessionId: session.sessionId });
      } else {
        deps.overlay.showComplete({ sessionId: session.sessionId });
      }
      currentSession = undefined;
      return getAppState();
    } catch (error) {
      const backendError = normalizeBackendError(error);
      const settings = deps.repositories.settings.getSettings();
      storeHistory(settings, buildErrorHistoryRow({ session, recording, error: backendError }));
      state = applyDictationEvent(state, {
        type: "fail",
        code: backendError.code,
        message: backendError.message
      });
      deps.overlay.showError(buildErrorOverlayInput(session.sessionId, backendError));
      currentSession = undefined;
      return getAppState();
    }
  }

  async function cancelDictation() {
    const session = requireCurrentSession();
    state = applyDictationEvent(state, { type: "cancel" });
    await deps.recorder.cancel(session.sessionId);
    deps.overlay.hide();
    currentSession = undefined;
    return getAppState();
  }

  function requireCurrentSession() {
    if (!currentSession) {
      throw new Error("dictation.no_active_session");
    }
    return currentSession;
  }

  function getDictionaryTerms(): DictionaryTerm[] {
    return deps.repositories.dictionary.listDictionaryTerms().map((term) => ({
      term: term.term,
      aliases: term.aliases,
      case_sensitive: term.case_sensitive,
      source: term.source
    }));
  }

  function storeHistory(settings: EchoSettings, row: HistoryRowInput) {
    if (settings.historyRetention === "never") {
      return;
    }

    deps.repositories.history.insertHistoryRow(row);
    deps.repositories.history.pruneHistory(settings.historyRetention);
  }
}

function normalizeRecorderStartError(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (/notallowed|permission|denied/i.test(message)) {
    return {
      code: "permission.microphone_missing",
      message: "Microphone permission is required to start dictation."
    };
  }

  return {
    code: "audio.device_unavailable",
    message: "No microphone input device is available."
  };
}

function normalizeRecorderStopError(_error: unknown) {
  return {
    code: "audio.recording_failed",
    message: "Could not finish recording. Please try again."
  };
}

function buildErrorOverlayInput(sessionId: string, error: BackendDictationError) {
  const input: { sessionId: string; code: string; message: string; recoverableText?: string } = {
    sessionId,
    code: error.code,
    message: error.message
  };

  if (error.rawText.trim().length > 0) {
    input.recoverableText = error.rawText;
  }

  return input;
}

function isSameInsertionTarget(startContext: DictationContext, currentContext: DictationContext) {
  return (
    startContext.bundle_id === currentContext.bundle_id &&
    startContext.app_name === currentContext.app_name &&
    currentContext.writable
  );
}

function getPreferences(settings: EchoSettings): DictationPreferences {
  return {
    style: settings.outputStyle,
    output_language: "follow_input",
    format_lists: true
  };
}

function buildCompletedHistoryRow(input: {
  session: CurrentSession;
  recording: RecordedAudio;
  response: DictationSuccessResponse;
  insertion: InsertionResult;
}): HistoryRowInput {
  return {
    id: input.session.sessionId,
    status: "completed",
    raw_text: input.response.raw_text,
    refined_text: input.response.refined_text,
    audio_local_path: input.recording.localPath,
    duration_ms: input.recording.durationMs,
    language: input.response.language,
    focused_app_name: input.session.context.app_name,
    focused_app_bundle_id: input.session.context.bundle_id,
    focused_app_window_title: input.session.context.window_title,
    insertion_method: input.insertion.method,
    insertion_status: input.insertion.status,
    provider_asr: input.response.provider.asr,
    provider_llm: input.response.provider.llm,
    error_code: null,
    timing_json: JSON.stringify(input.response.timing)
  };
}

function buildErrorHistoryRow(input: {
  session: CurrentSession;
  recording: RecordedAudio;
  error: BackendDictationError;
}): HistoryRowInput {
  return {
    id: input.session.sessionId,
    status: "error",
    raw_text: input.error.rawText,
    refined_text: "",
    audio_local_path: input.recording.localPath,
    duration_ms: input.recording.durationMs,
    language: "auto",
    focused_app_name: input.session.context.app_name,
    focused_app_bundle_id: input.session.context.bundle_id,
    focused_app_window_title: input.session.context.window_title,
    insertion_method: "none",
    insertion_status: "not_inserted",
    provider_asr: "unavailable",
    provider_llm: "unavailable",
    error_code: input.error.code,
    timing_json: "{}"
  };
}

function normalizeBackendError(error: unknown): BackendDictationError {
  if (error instanceof BackendDictationError) {
    return error;
  }

  return new BackendDictationError({
    code: "server.refine_failed",
    message: error instanceof Error ? error.message : "Dictation processing failed.",
    recoverable: true,
    rawText: ""
  });
}
