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
import type { PermissionStatusSnapshot } from "../platform/permissions";
import type { DictionaryTermRow } from "../storage/dictionaryRepository";
import type { HistoryRow, HistoryRowInput } from "../storage/historyRepository";
import type { EchoSettings } from "../storage/settingsRepository";
import type { AudioDucker } from "../platform/audioDucking";

export interface RecordedAudio {
  audio: Buffer;
  audioFormat: AudioFormat;
  durationMs: number;
  localPath: string | null;
}

export type InteractionSoundEvent = "start" | "complete" | "error";
const processingStageText = "Transcribing audio and refining text";

export interface DictationSessionControllerDeps {
  createSessionId: () => string;
  now: () => string;
  getPermissionStatus: () => PermissionStatusSnapshot;
  getProviderStartupError?: () => string | undefined;
  captureContext: () => Promise<DictationContext>;
  recorder: {
    start: (sessionId: string) => Promise<void>;
    stop: (sessionId: string) => Promise<RecordedAudio>;
    cancel: (sessionId: string) => Promise<void>;
  };
  backend: (input: Omit<ProcessDictationInput, "apiBaseUrl" | "fetchImpl">) => Promise<DictationSuccessResponse>;
  insertText: (text: string) => Promise<InsertionResult>;
  copyText: (text: string) => Promise<InsertionResult>;
  playInteractionSound?: (event: InteractionSoundEvent) => void;
  audioDucker?: AudioDucker;
  readLocalRecording: (localPath: string) => Promise<Buffer>;
  deleteLocalRecording: (localPath: string) => Promise<void>;
  overlay: {
    showRecording: (input: { sessionId: string; context: DictationContext }) => void;
    showFinalizing: (input: { sessionId: string }) => void;
    showProcessing: (input: { sessionId: string; stageText?: string }) => void;
    showInserting: (input: { sessionId: string }) => void;
    showCopied: (input: { sessionId: string }) => void;
    showError: (input: {
      sessionId: string;
      code: string;
      message: string;
      recoverableText?: string;
      retryHistoryId?: string;
    }) => void;
    showComplete: (input: { sessionId: string }) => void;
    hide: () => void;
  };
  repositories: {
    history: {
      insertHistoryRow: (row: HistoryRowInput) => void;
      getHistoryRow: (id: string) => HistoryRow | undefined;
      updateInsertionStatus: (id: string, insertionStatus: string) => void;
      pruneHistory: (retention: EchoSettings["historyRetention"]) => string[];
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
  audioDucked: boolean;
}

export function createDictationSessionController(deps: DictationSessionControllerDeps) {
  let state: DictationState = { status: "idle" };
  let currentSession: CurrentSession | undefined;

  return {
    getAppState,
    startDictation,
    stopDictation,
    cancelDictation,
    retryHistoryRow
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
    const providerStartupError = deps.getProviderStartupError?.();

    if (providerStartupError?.startsWith("config.")) {
      const message = messageForProviderStartupError(providerStartupError);
      state = {
        status: "error",
        sessionId,
        code: providerStartupError,
        message
      };
      deps.overlay.showError({ sessionId, code: providerStartupError, message });
      return getAppState();
    }

    const permissions = deps.getPermissionStatus();

    if (permissions.microphone === "denied" || permissions.microphone === "restricted") {
      const code = "permission.microphone_missing";
      const message = "Microphone permission is required to start dictation.";
      state = {
        status: "error",
        sessionId,
        code,
        message
      };
      deps.overlay.showError({ sessionId, code, message });
      return getAppState();
    }

    if (permissions.accessibility !== "granted") {
      const code = "permission.accessibility_missing";
      const message = "Accessibility permission is required to insert dictation into other apps.";
      state = {
        status: "error",
        sessionId,
        code,
        message
      };
      deps.overlay.showError({ sessionId, code, message });
      return getAppState();
    }

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

    const settings = deps.repositories.settings.getSettings();
    const audioDucked = await maybeDuckOtherAudio(settings);

    currentSession = {
      sessionId,
      context,
      startedAt: deps.now(),
      audioDucked
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
      await maybeRestoreOtherAudio({ audioDucked });
      deps.overlay.showError({ sessionId, code: recorderError.code, message: recorderError.message });
      return getAppState();
    }

    state = applyDictationEvent(state, { type: "recording_started", sessionId });
    deps.overlay.showRecording({ sessionId, context });
    maybePlayInteractionSound("start");

    return getAppState();
  }

  async function stopDictation() {
    const session = requireCurrentSession();
    state = applyDictationEvent(state, { type: "stop_requested" });
    deps.overlay.showFinalizing({ sessionId: session.sessionId });

    let recording: RecordedAudio;
    try {
      recording = await deps.recorder.stop(session.sessionId);
    } catch (error) {
      if (isRecorderCancellation(error, state, session.sessionId)) {
        return getAppState();
      }
      const recorderError = normalizeRecorderStopError(error);
      await maybeRestoreOtherAudio(session);
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
    await maybeRestoreOtherAudio(session);

    state = applyDictationEvent(state, { type: "processing_started" });
    deps.overlay.showProcessing({ sessionId: session.sessionId, stageText: processingStageText });

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
      const insertion = await insertOrCopyRefinedText(response.refined_text, session.context, currentContext);

      await storeHistory(settings, buildCompletedHistoryRow({ session, recording, response, insertion }));

      state = applyDictationEvent(state, { type: "completed" });
      if (insertion.status === "copied") {
        deps.overlay.showCopied({ sessionId: session.sessionId });
      } else {
        deps.overlay.showComplete({ sessionId: session.sessionId });
      }
      maybePlayInteractionSound("complete");
      currentSession = undefined;
      return getAppState();
    } catch (error) {
      const backendError = normalizeBackendError(error);
      const settings = deps.repositories.settings.getSettings();
      await storeHistory(settings, buildErrorHistoryRow({ session, recording, error: backendError }));
      const retryHistoryId = settings.historyRetention !== "never" && recording.localPath ? session.sessionId : undefined;
      state = applyDictationEvent(state, {
        type: "fail",
        code: backendError.code,
        message: backendError.message
      });
      deps.overlay.showError(buildErrorOverlayInput(session.sessionId, backendError, retryHistoryId));
      maybePlayInteractionSound("error");
      currentSession = undefined;
      return getAppState();
    }
  }

  async function cancelDictation() {
    const session = requireCurrentSession();
    state = applyDictationEvent(state, { type: "cancel" });
    try {
      await deps.recorder.cancel(session.sessionId);
    } finally {
      await maybeRestoreOtherAudio(session);
    }
    await storeHistory(deps.repositories.settings.getSettings(), buildCancelledHistoryRow(session));
    deps.overlay.hide();
    currentSession = undefined;
    return getAppState();
  }

  async function retryHistoryRow(id: string) {
    const source = deps.repositories.history.getHistoryRow(id);
    const sessionId = deps.createSessionId();

    if (!source || !isRetryableHistoryRow(source)) {
      const code = "history.retry_unavailable";
      const message = "Retry is available only when a failed recording is still retained locally.";
      state = { status: "error", sessionId, code, message };
      deps.overlay.showError({ sessionId, code, message });
      return getAppState();
    }

    const context = buildContextFromHistoryRow(source);
    const audioFormat = audioFormatFromLocalPath(source.audio_local_path);
    let audio: Buffer;
    try {
      audio = await deps.readLocalRecording(source.audio_local_path);
    } catch {
      const code = "history.retry_unavailable";
      const message = "The retained recording could not be read. Try a new dictation.";
      state = { status: "error", sessionId, code, message };
      deps.overlay.showError({ sessionId, code, message });
      return getAppState();
    }
    const recording: RecordedAudio = {
      audio,
      audioFormat,
      durationMs: source.duration_ms,
      localPath: null
    };
    const session: CurrentSession = {
      sessionId,
      context,
      startedAt: deps.now(),
      audioDucked: false
    };

    state = { status: "processing", sessionId };
    deps.overlay.showProcessing({ sessionId, stageText: processingStageText });

    try {
      const settings = deps.repositories.settings.getSettings();
      const response = await deps.backend({
        sessionId,
        audio,
        audioFormat,
        durationMs: source.duration_ms,
        language: source.language || settings.language,
        context,
        dictionary: getDictionaryTerms(),
        preferences: getPreferences(settings)
      });
      const insertion = await deps.copyText(response.refined_text);

      await storeHistory(settings, buildCompletedHistoryRow({ session, recording, response, insertion }));

      state = { status: "complete", sessionId };
      deps.overlay.showCopied({ sessionId });
      return getAppState();
    } catch (error) {
      const backendError = normalizeBackendError(error);
      const settings = deps.repositories.settings.getSettings();
      await storeHistory(settings, buildErrorHistoryRow({ session, recording, error: backendError }));
      state = {
        status: "error",
        sessionId,
        code: backendError.code,
        message: backendError.message
      };
      deps.overlay.showError(buildErrorOverlayInput(sessionId, backendError));
      return getAppState();
    }
  }

  function requireCurrentSession() {
    if (!currentSession) {
      throw new Error("dictation.no_active_session");
    }
    return currentSession;
  }

  function maybePlayInteractionSound(event: InteractionSoundEvent) {
    if (deps.repositories.settings.getSettings().interactionSounds) {
      deps.playInteractionSound?.(event);
    }
  }

  async function insertOrCopyRefinedText(
    refinedText: string,
    startContext: DictationContext,
    currentContext: DictationContext
  ) {
    if (!isSameInsertionTarget(startContext, currentContext)) {
      return deps.copyText(refinedText);
    }

    try {
      return await deps.insertText(refinedText);
    } catch {
      return deps.copyText(refinedText);
    }
  }

  async function maybeDuckOtherAudio(settings: EchoSettings) {
    if (!settings.muteOtherAudioWhileDictating || !deps.audioDucker) {
      return false;
    }

    try {
      await deps.audioDucker.duck();
      return true;
    } catch {
      return false;
    }
  }

  async function maybeRestoreOtherAudio(session: Pick<CurrentSession, "audioDucked">) {
    if (!session.audioDucked || !deps.audioDucker) {
      return;
    }

    try {
      await deps.audioDucker.restore();
      session.audioDucked = false;
    } catch {
      // Audio ducking is best-effort; recording recovery should not block dictation flow.
    }
  }

  function getDictionaryTerms(): DictionaryTerm[] {
    return deps.repositories.dictionary.listDictionaryTerms().map((term) => ({
      term: term.term,
      aliases: term.aliases,
      case_sensitive: term.case_sensitive,
      source: term.source,
      ...(term.language ? { language: term.language } : {}),
      ...(term.pronunciation_hint ? { pronunciation_hint: term.pronunciation_hint } : {}),
      ...(term.capitalization ? { capitalization: term.capitalization } : {})
    }));
  }

  async function storeHistory(settings: EchoSettings, row: HistoryRowInput) {
    if (settings.historyRetention === "never") {
      await deleteLocalRecording(row.audio_local_path);
      return;
    }

    deps.repositories.history.insertHistoryRow(row);
    await deleteLocalRecordings(deps.repositories.history.pruneHistory(settings.historyRetention));
  }

  async function deleteLocalRecordings(localPaths: string[]) {
    await Promise.all(localPaths.map((localPath) => deleteLocalRecording(localPath)));
  }

  async function deleteLocalRecording(localPath: string | null) {
    if (!localPath) {
      return;
    }
    try {
      await deps.deleteLocalRecording(localPath);
    } catch {
      // Local cleanup must not turn a successful dictation into a failed one.
    }
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

function messageForProviderStartupError(code: string) {
  switch (code) {
    case "config.llm_model_missing":
      return "LLM configuration missing. Set LLM_MODEL.";
    case "config.llm_key_missing":
      return "LLM configuration missing. Set LLM_API_KEY or API_KEY.";
    case "config.asr_key_missing":
      return "ASR configuration missing. Set ASR_API_KEY or API_KEY.";
    case "config.llm_missing":
      return "LLM configuration missing. Set LLM_MODEL and LLM_API_KEY.";
    case "config.asr_missing":
      return "ASR configuration missing. Set ASR_API_KEY or API_KEY.";
    default:
      return "Provider configuration is missing.";
  }
}

function normalizeRecorderStopError(_error: unknown) {
  return {
    code: "audio.recording_failed",
    message: "Could not finish recording. Please try again."
  };
}

function isRecorderCancellation(error: unknown, state: DictationState, sessionId: string) {
  const message = error instanceof Error ? error.message : "";
  return state.status === "cancelled" && state.sessionId === sessionId && message === "audio.recording_cancelled";
}

function buildErrorOverlayInput(sessionId: string, error: BackendDictationError, retryHistoryId?: string) {
  const input: { sessionId: string; code: string; message: string; recoverableText?: string; retryHistoryId?: string } = {
    sessionId,
    code: error.code,
    message: error.message
  };

  if (error.rawText.trim().length > 0) {
    input.recoverableText = error.rawText;
  }
  if (retryHistoryId) {
    input.retryHistoryId = retryHistoryId;
  }

  return input;
}

function isSameInsertionTarget(startContext: DictationContext, currentContext: DictationContext) {
  return (
    startContext.bundle_id === currentContext.bundle_id &&
    startContext.app_name === currentContext.app_name &&
    startContext.window_title === currentContext.window_title &&
    startContext.focused_role === currentContext.focused_role &&
    !startContext.selection_present &&
    !currentContext.selection_present &&
    currentContext.writable
  );
}

function isRetryableHistoryRow(row: HistoryRow): row is HistoryRow & { audio_local_path: string } {
  return (row.status === "error" || row.status === "cancelled") && Boolean(row.audio_local_path);
}

function buildContextFromHistoryRow(row: HistoryRow): DictationContext {
  return {
    app_name: row.focused_app_name,
    bundle_id: row.focused_app_bundle_id,
    window_title: row.focused_app_window_title,
    writable: true,
    selection_present: false,
    nearby_text: ""
  };
}

function audioFormatFromLocalPath(localPath: string): AudioFormat {
  if (localPath.toLowerCase().endsWith(".wav")) {
    return "wav";
  }
  return "webm";
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
    output_length: input.response.refined_text.length,
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
    output_length: input.error.rawText.length,
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

function buildCancelledHistoryRow(session: CurrentSession): HistoryRowInput {
  return {
    id: session.sessionId,
    status: "cancelled",
    raw_text: "",
    refined_text: "",
    audio_local_path: null,
    duration_ms: 0,
    output_length: 0,
    language: "auto",
    focused_app_name: session.context.app_name,
    focused_app_bundle_id: session.context.bundle_id,
    focused_app_window_title: session.context.window_title,
    insertion_method: "none",
    insertion_status: "not_inserted",
    provider_asr: "not_started",
    provider_llm: "not_started",
    error_code: "dictation.cancelled",
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
