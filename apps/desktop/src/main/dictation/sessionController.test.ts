import { describe, expect, it, vi } from "vitest";
import { BackendDictationError } from "./backendClient";
import { createDictationSessionController } from "./sessionController";
import type { PermissionStatusSnapshot } from "../platform/permissions";
import type { HistoryRow } from "../storage/historyRepository";
import type { EchoSettings } from "../storage/settingsRepository";

const context = {
  app_name: "TextEdit",
  bundle_id: "com.apple.TextEdit",
  window_title: "Untitled",
  writable: true,
  selection_present: false,
  nearby_text: ""
};

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

function createDeps() {
  const historyRows: unknown[] = [];
  return {
    historyRows,
    deps: {
      createSessionId: () => "session-1",
      now: () => "2026-05-02T00:00:00.000Z",
      getPermissionStatus: vi.fn<() => PermissionStatusSnapshot>(() => ({
        microphone: "granted",
        accessibility: "granted"
      })),
      getProviderStartupError: vi.fn(() => undefined as string | undefined),
      captureContext: vi.fn().mockResolvedValue(context),
      recorder: {
        start: vi.fn().mockResolvedValue(undefined),
        stop: vi.fn().mockResolvedValue({
          audio: Buffer.from("audio"),
          audioFormat: "webm" as const,
          durationMs: 1200,
          localPath: "/tmp/session-1.webm"
        }),
        cancel: vi.fn().mockResolvedValue(undefined)
      },
      backend: vi.fn().mockResolvedValue({
        session_id: "session-1",
        raw_text: "um tomorrow at seven no make it three",
        refined_text: "Tomorrow at three.",
        language: "en",
        provider: { asr: "openai:gpt-4o-transcribe", llm: "openai-compatible:gpt-4o" },
        timing: {
          upload_received_at: "2026-05-02T00:00:00.000Z",
          asr_ms: 800,
          refine_ms: 350,
          total_ms: 1150
        },
        quality: { risk: "low" as const, warnings: [] }
      }),
      insertText: vi.fn().mockResolvedValue({ method: "clipboard_paste" as const, status: "inserted" as const }),
      copyText: vi.fn().mockResolvedValue({ method: "clipboard" as const, status: "copied" as const }),
      playInteractionSound: vi.fn(),
      audioDucker: {
        duck: vi.fn().mockResolvedValue(undefined),
        restore: vi.fn().mockResolvedValue(undefined)
      },
      readLocalRecording: vi.fn().mockResolvedValue(Buffer.from("retry-audio")),
      deleteLocalRecording: vi.fn().mockResolvedValue(undefined),
      overlay: {
        showRecording: vi.fn(),
        showFinalizing: vi.fn(),
        showProcessing: vi.fn(),
        showInserting: vi.fn(),
        showCopied: vi.fn(),
        showError: vi.fn(),
        showComplete: vi.fn(),
        hide: vi.fn()
      },
      repositories: {
        history: {
          insertHistoryRow: vi.fn((row: unknown) => historyRows.push(row)),
          getHistoryRow: vi.fn<() => HistoryRow | undefined>(() => undefined),
          updateInsertionStatus: vi.fn(),
          pruneHistory: vi.fn<() => string[]>(() => [])
        },
        dictionary: {
          listDictionaryTerms: vi.fn(() => [
            {
              id: "term-1",
              created_at: "2026-05-02T00:00:00.000Z",
              updated_at: "2026-05-02T00:00:00.000Z",
              term: "Echo",
              aliases: [],
              case_sensitive: true,
              source: "manual" as const,
              language: "en"
            }
          ])
        },
        settings: {
          getSettings: vi.fn<() => EchoSettings>(() => defaultSettings)
        }
      }
    }
  };
}

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((innerResolve, innerReject) => {
    resolve = innerResolve;
    reject = innerReject;
  });
  return { promise, resolve, reject };
}

describe("createDictationSessionController", () => {
  it("starting from idle creates a session and requests recorder start", async () => {
    const { deps } = createDeps();
    const controller = createDictationSessionController(deps);

    const snapshot = await controller.startDictation();

    expect(deps.captureContext).toHaveBeenCalled();
    expect(deps.recorder.start).toHaveBeenCalledWith("session-1");
    expect(deps.overlay.showRecording).toHaveBeenCalledWith({ sessionId: "session-1", context });
    expect(snapshot.state).toEqual({ status: "recording", sessionId: "session-1" });
  });

  it("does not start recording when the focused target is not writable", async () => {
    const { deps } = createDeps();
    deps.captureContext.mockResolvedValueOnce({ ...context, writable: false });
    const controller = createDictationSessionController(deps);

    const snapshot = await controller.startDictation();

    expect(deps.recorder.start).not.toHaveBeenCalled();
    expect(deps.overlay.showError).toHaveBeenCalledWith({
      sessionId: "session-1",
      code: "target.no_writable_field",
      message: "Focus a writable text field before starting dictation."
    });
    expect(snapshot.state).toEqual({
      status: "error",
      sessionId: "session-1",
      code: "target.no_writable_field",
      message: "Focus a writable text field before starting dictation."
    });
  });

  it("does not start recording when accessibility permission is missing", async () => {
    const { deps } = createDeps();
    deps.getPermissionStatus.mockReturnValueOnce({ microphone: "granted", accessibility: "denied" });
    const controller = createDictationSessionController(deps);

    const snapshot = await controller.startDictation();

    expect(deps.captureContext).not.toHaveBeenCalled();
    expect(deps.recorder.start).not.toHaveBeenCalled();
    expect(deps.overlay.showError).toHaveBeenCalledWith({
      sessionId: "session-1",
      code: "permission.accessibility_missing",
      message: "Accessibility permission is required to insert dictation into other apps."
    });
    expect(snapshot.state).toEqual({
      status: "error",
      sessionId: "session-1",
      code: "permission.accessibility_missing",
      message: "Accessibility permission is required to insert dictation into other apps."
    });
  });

  it("does not start recording when microphone permission is denied", async () => {
    const { deps } = createDeps();
    deps.getPermissionStatus.mockReturnValueOnce({ microphone: "denied", accessibility: "granted" });
    const controller = createDictationSessionController(deps);

    const snapshot = await controller.startDictation();

    expect(deps.captureContext).not.toHaveBeenCalled();
    expect(deps.recorder.start).not.toHaveBeenCalled();
    expect(deps.overlay.showError).toHaveBeenCalledWith({
      sessionId: "session-1",
      code: "permission.microphone_missing",
      message: "Microphone permission is required to start dictation."
    });
    expect(snapshot.state).toEqual({
      status: "error",
      sessionId: "session-1",
      code: "permission.microphone_missing",
      message: "Microphone permission is required to start dictation."
    });
  });

  it("does not start recording when provider configuration is missing", async () => {
    const { deps } = createDeps();
    deps.getProviderStartupError.mockReturnValueOnce("config.llm_model_missing");
    const controller = createDictationSessionController(deps);

    const snapshot = await controller.startDictation();

    expect(deps.captureContext).not.toHaveBeenCalled();
    expect(deps.recorder.start).not.toHaveBeenCalled();
    expect(deps.overlay.showError).toHaveBeenCalledWith({
      sessionId: "session-1",
      code: "config.llm_model_missing",
      message: "LLM configuration missing. Set LLM_MODEL."
    });
    expect(snapshot.state).toEqual({
      status: "error",
      sessionId: "session-1",
      code: "config.llm_model_missing",
      message: "LLM configuration missing. Set LLM_MODEL."
    });
  });

  it("allows not-determined microphone permission so macOS can prompt during recording start", async () => {
    const { deps } = createDeps();
    deps.getPermissionStatus.mockReturnValueOnce({ microphone: "not-determined", accessibility: "granted" });
    const controller = createDictationSessionController(deps);

    await controller.startDictation();

    expect(deps.captureContext).toHaveBeenCalled();
    expect(deps.recorder.start).toHaveBeenCalledWith("session-1");
  });

  it("reports microphone permission errors when recorder start fails", async () => {
    const { deps } = createDeps();
    deps.recorder.start.mockRejectedValueOnce(new Error("NotAllowedError: Permission denied"));
    const controller = createDictationSessionController(deps);

    const snapshot = await controller.startDictation();

    expect(deps.overlay.showRecording).not.toHaveBeenCalled();
    expect(deps.overlay.showError).toHaveBeenCalledWith({
      sessionId: "session-1",
      code: "permission.microphone_missing",
      message: "Microphone permission is required to start dictation."
    });
    expect(snapshot.state).toEqual({
      status: "error",
      sessionId: "session-1",
      code: "permission.microphone_missing",
      message: "Microphone permission is required to start dictation."
    });
  });

  it("reports recorder stop errors instead of leaving the session in finalizing", async () => {
    const { deps } = createDeps();
    deps.recorder.stop.mockRejectedValueOnce(new Error("audio.encoder_failed"));
    const controller = createDictationSessionController(deps);

    await controller.startDictation();
    const snapshot = await controller.stopDictation();

    expect(deps.overlay.showProcessing).not.toHaveBeenCalled();
    expect(deps.overlay.showError).toHaveBeenCalledWith({
      sessionId: "session-1",
      code: "audio.recording_failed",
      message: "Could not finish recording. Please try again."
    });
    expect(snapshot.state).toEqual({
      status: "error",
      sessionId: "session-1",
      code: "audio.recording_failed",
      message: "Could not finish recording. Please try again."
    });
  });

  it("stopping from recording processes audio, inserts refined text, and writes history", async () => {
    const { deps, historyRows } = createDeps();
    const controller = createDictationSessionController(deps);

    await controller.startDictation();
    const snapshot = await controller.stopDictation();

    expect(deps.backend).toHaveBeenCalledWith(expect.objectContaining({ sessionId: "session-1", audioFormat: "webm" }));
    expect(deps.overlay.showFinalizing).toHaveBeenCalledWith({ sessionId: "session-1" });
    expect(deps.overlay.showProcessing).toHaveBeenCalledWith({
      sessionId: "session-1",
      stageText: "Transcribing audio and refining text"
    });
    expect(deps.overlay.showInserting).toHaveBeenCalledWith({ sessionId: "session-1" });
    expect(deps.insertText).toHaveBeenCalledWith("Tomorrow at three.");
    expect(historyRows).toHaveLength(1);
    expect(historyRows[0]).toMatchObject({
      id: "session-1",
      status: "completed",
      raw_text: "um tomorrow at seven no make it three",
      refined_text: "Tomorrow at three.",
      insertion_status: "inserted"
    });
    expect(snapshot.state).toEqual({ status: "complete", sessionId: "session-1" });
  });

  it("plays interaction sounds for recording start and successful completion when enabled", async () => {
    const { deps } = createDeps();
    const controller = createDictationSessionController(deps);

    await controller.startDictation();
    await controller.stopDictation();

    expect(deps.playInteractionSound).toHaveBeenCalledWith("start");
    expect(deps.playInteractionSound).toHaveBeenCalledWith("complete");
  });

  it("mutes other audio while recording when the setting is enabled", async () => {
    const { deps } = createDeps();
    deps.repositories.settings.getSettings.mockReturnValue({
      ...defaultSettings,
      muteOtherAudioWhileDictating: true
    });
    const controller = createDictationSessionController(deps);

    await controller.startDictation();
    await controller.stopDictation();

    expect(deps.audioDucker.duck.mock.invocationCallOrder[0]).toBeLessThan(
      deps.recorder.start.mock.invocationCallOrder[0] ?? 0
    );
    expect(deps.audioDucker.restore.mock.invocationCallOrder[0]).toBeGreaterThan(
      deps.recorder.stop.mock.invocationCallOrder[0] ?? Number.MAX_SAFE_INTEGER
    );
  });

  it("restores other audio when recording start fails after muting", async () => {
    const { deps } = createDeps();
    deps.repositories.settings.getSettings.mockReturnValue({
      ...defaultSettings,
      muteOtherAudioWhileDictating: true
    });
    deps.recorder.start.mockRejectedValueOnce(new Error("audio.device_unavailable"));
    const controller = createDictationSessionController(deps);

    await controller.startDictation();

    expect(deps.audioDucker.duck).toHaveBeenCalled();
    expect(deps.audioDucker.restore).toHaveBeenCalled();
  });

  it("restores other audio when recording is cancelled", async () => {
    const { deps } = createDeps();
    deps.repositories.settings.getSettings.mockReturnValue({
      ...defaultSettings,
      muteOtherAudioWhileDictating: true
    });
    const controller = createDictationSessionController(deps);

    await controller.startDictation();
    await controller.cancelDictation();

    expect(deps.audioDucker.restore).toHaveBeenCalled();
  });

  it("stores a clearly cancelled history row when recording is cancelled and history is enabled", async () => {
    const { deps, historyRows } = createDeps();
    const controller = createDictationSessionController(deps);

    await controller.startDictation();
    await controller.cancelDictation();

    expect(historyRows[0]).toMatchObject({
      id: "session-1",
      status: "cancelled",
      raw_text: "",
      refined_text: "",
      audio_local_path: null,
      duration_ms: 0,
      output_length: 0,
      language: "auto",
      focused_app_name: "TextEdit",
      focused_app_bundle_id: "com.apple.TextEdit",
      focused_app_window_title: "Untitled",
      insertion_method: "none",
      insertion_status: "not_inserted",
      provider_asr: "not_started",
      provider_llm: "not_started",
      error_code: "dictation.cancelled",
      timing_json: "{}"
    });
  });

  it("keeps finalizing cancellation from being overwritten by a cancelled recorder stop", async () => {
    const { deps, historyRows } = createDeps();
    const stop = createDeferred<{
      audio: Buffer;
      audioFormat: "webm";
      durationMs: number;
      localPath: string;
    }>();
    deps.recorder.stop.mockReturnValueOnce(stop.promise);
    const controller = createDictationSessionController(deps);

    await controller.startDictation();
    const stopSnapshot = controller.stopDictation();
    await Promise.resolve();
    const cancelSnapshot = await controller.cancelDictation();
    stop.reject(new Error("audio.recording_cancelled"));
    await stopSnapshot;

    expect(cancelSnapshot.state).toEqual({ status: "cancelled", sessionId: "session-1" });
    expect(deps.overlay.showError).not.toHaveBeenCalledWith(
      expect.objectContaining({ code: "audio.recording_failed" })
    );
    expect(deps.backend).not.toHaveBeenCalled();
    expect(historyRows).toHaveLength(1);
    expect(historyRows[0]).toMatchObject({
      status: "cancelled",
      error_code: "dictation.cancelled"
    });
  });

  it("does not play interaction sounds when the setting is disabled", async () => {
    const { deps } = createDeps();
    deps.repositories.settings.getSettings.mockReturnValue({ ...defaultSettings, interactionSounds: false });
    const controller = createDictationSessionController(deps);

    await controller.startDictation();
    await controller.stopDictation();

    expect(deps.playInteractionSound).not.toHaveBeenCalled();
  });

  it("records backend errors without inserting fabricated text", async () => {
    const { deps, historyRows } = createDeps();
    deps.backend.mockRejectedValueOnce(
      new BackendDictationError({
        code: "server.asr_failed",
        message: "Speech recognition failed.",
        recoverable: true,
        rawText: ""
      })
    );
    const controller = createDictationSessionController(deps);

    await controller.startDictation();
    const snapshot = await controller.stopDictation();

    expect(deps.insertText).not.toHaveBeenCalled();
    expect(historyRows[0]).toMatchObject({
      id: "session-1",
      status: "error",
      raw_text: "",
      refined_text: "",
      error_code: "server.asr_failed",
      insertion_status: "not_inserted"
    });
    expect(deps.overlay.showError).toHaveBeenCalledWith({
      sessionId: "session-1",
      code: "server.asr_failed",
      message: "Speech recognition failed.",
      retryHistoryId: "session-1"
    });
    expect(snapshot.state).toEqual({
      status: "error",
      sessionId: "session-1",
      code: "server.asr_failed",
      message: "Speech recognition failed."
    });
    expect(deps.playInteractionSound).toHaveBeenCalledWith("error");
  });

  it("passes raw transcript to error recovery when backend returns recoverable text", async () => {
    const { deps } = createDeps();
    deps.backend.mockRejectedValueOnce(
      new BackendDictationError({
        code: "server.refine_failed",
        message: "Dictation refinement failed.",
        recoverable: true,
        rawText: "raw transcript"
      })
    );
    const controller = createDictationSessionController(deps);

    await controller.startDictation();
    await controller.stopDictation();

    expect(deps.overlay.showError).toHaveBeenCalledWith({
      sessionId: "session-1",
      code: "server.refine_failed",
      message: "Dictation refinement failed.",
      recoverableText: "raw transcript",
      retryHistoryId: "session-1"
    });
  });

  it("does not store history when retention is never", async () => {
    const { deps, historyRows } = createDeps();
    deps.repositories.settings.getSettings.mockReturnValue({
      ...defaultSettings,
      historyRetention: "never"
    });
    const controller = createDictationSessionController(deps);

    await controller.startDictation();
    await controller.stopDictation();

    expect(historyRows).toEqual([]);
    expect(deps.deleteLocalRecording).toHaveBeenCalledWith("/tmp/session-1.webm");
  });

  it("prunes history after storing a completed row", async () => {
    const { deps } = createDeps();
    const controller = createDictationSessionController(deps);

    await controller.startDictation();
    await controller.stopDictation();

    expect(deps.repositories.history.pruneHistory).toHaveBeenCalledWith("1_week");
  });

  it("deletes audio files returned by history pruning", async () => {
    const { deps } = createDeps();
    deps.repositories.history.pruneHistory.mockReturnValueOnce(["/tmp/old-session.webm"]);
    const controller = createDictationSessionController(deps);

    await controller.startDictation();
    await controller.stopDictation();

    expect(deps.deleteLocalRecording).toHaveBeenCalledWith("/tmp/old-session.webm");
  });

  it("copies refined text without pasting when focus changes before insertion", async () => {
    const { deps, historyRows } = createDeps();
    deps.captureContext
      .mockResolvedValueOnce(context)
      .mockResolvedValueOnce({
        ...context,
        app_name: "Notes",
        bundle_id: "com.apple.Notes"
      });
    const controller = createDictationSessionController(deps);

    await controller.startDictation();
    await controller.stopDictation();

    expect(deps.insertText).not.toHaveBeenCalled();
    expect(deps.copyText).toHaveBeenCalledWith("Tomorrow at three.");
    expect(deps.overlay.showCopied).toHaveBeenCalledWith({ sessionId: "session-1" });
    expect(historyRows[0]).toMatchObject({
      insertion_method: "clipboard",
      insertion_status: "copied"
    });
  });

  it("copies refined text without pasting when the focused window changes inside the same app", async () => {
    const { deps, historyRows } = createDeps();
    deps.captureContext
      .mockResolvedValueOnce(context)
      .mockResolvedValueOnce({
        ...context,
        window_title: "Other Draft"
      });
    const controller = createDictationSessionController(deps);

    await controller.startDictation();
    await controller.stopDictation();

    expect(deps.insertText).not.toHaveBeenCalled();
    expect(deps.copyText).toHaveBeenCalledWith("Tomorrow at three.");
    expect(historyRows[0]).toMatchObject({
      insertion_method: "clipboard",
      insertion_status: "copied"
    });
  });

  it("copies refined text without pasting when the focused element role changes inside the same window", async () => {
    const { deps, historyRows } = createDeps();
    deps.captureContext
      .mockResolvedValueOnce({
        ...context,
        focused_role: "AXTextArea"
      })
      .mockResolvedValueOnce({
        ...context,
        focused_role: "AXTextField"
      });
    const controller = createDictationSessionController(deps);

    await controller.startDictation();
    await controller.stopDictation();

    expect(deps.insertText).not.toHaveBeenCalled();
    expect(deps.copyText).toHaveBeenCalledWith("Tomorrow at three.");
    expect(historyRows[0]).toMatchObject({
      insertion_method: "clipboard",
      insertion_status: "copied"
    });
  });

  it("copies refined text without pasting when the current target has selected text", async () => {
    const { deps, historyRows } = createDeps();
    deps.captureContext
      .mockResolvedValueOnce(context)
      .mockResolvedValueOnce({
        ...context,
        selection_present: true
      });
    const controller = createDictationSessionController(deps);

    await controller.startDictation();
    await controller.stopDictation();

    expect(deps.insertText).not.toHaveBeenCalled();
    expect(deps.copyText).toHaveBeenCalledWith("Tomorrow at three.");
    expect(historyRows[0]).toMatchObject({
      insertion_method: "clipboard",
      insertion_status: "copied"
    });
  });

  it("copies refined text without pasting when the starting target had selected text", async () => {
    const { deps, historyRows } = createDeps();
    deps.captureContext
      .mockResolvedValueOnce({
        ...context,
        selection_present: true
      })
      .mockResolvedValueOnce(context);
    const controller = createDictationSessionController(deps);

    await controller.startDictation();
    await controller.stopDictation();

    expect(deps.insertText).not.toHaveBeenCalled();
    expect(deps.copyText).toHaveBeenCalledWith("Tomorrow at three.");
    expect(historyRows[0]).toMatchObject({
      insertion_method: "clipboard",
      insertion_status: "copied"
    });
  });

  it("falls back to copying refined text when insertion throws", async () => {
    const { deps, historyRows } = createDeps();
    deps.insertText.mockRejectedValueOnce(new Error("insert failed"));
    const controller = createDictationSessionController(deps);

    await controller.startDictation();
    const snapshot = await controller.stopDictation();

    expect(deps.copyText).toHaveBeenCalledWith("Tomorrow at three.");
    expect(deps.overlay.showCopied).toHaveBeenCalledWith({ sessionId: "session-1" });
    expect(historyRows[0]).toMatchObject({
      status: "completed",
      insertion_method: "clipboard",
      insertion_status: "copied"
    });
    expect(snapshot.state).toEqual({ status: "complete", sessionId: "session-1" });
  });

  it("passes the configured output style to backend refinement preferences", async () => {
    const { deps } = createDeps();
    deps.repositories.settings.getSettings.mockReturnValue({
      ...defaultSettings,
      outputStyle: "polished"
    });
    const controller = createDictationSessionController(deps);

    await controller.startDictation();
    await controller.stopDictation();

    expect(deps.backend).toHaveBeenCalledWith(
      expect.objectContaining({
        preferences: expect.objectContaining({
          style: "polished"
        })
      })
    );
  });

  it("passes dictionary language metadata to backend refinement", async () => {
    const { deps } = createDeps();
    const controller = createDictationSessionController(deps);

    await controller.startDictation();
    await controller.stopDictation();

    expect(deps.backend).toHaveBeenCalledWith(
      expect.objectContaining({
        dictionary: [
          expect.objectContaining({
            term: "Echo",
            language: "en"
          })
        ]
      })
    );
  });

  it("retries a failed history row from retained audio and copies the refined result", async () => {
    const { deps, historyRows } = createDeps();
    deps.repositories.history.getHistoryRow.mockReturnValue({
      id: "failed-1",
      created_at: "2026-05-02T00:00:00.000Z",
      updated_at: "2026-05-02T00:00:00.000Z",
      status: "error",
      raw_text: "raw transcript",
      refined_text: "",
      audio_local_path: "/tmp/failed-1.webm",
      duration_ms: 1800,
      output_length: 14,
      language: "en",
      focused_app_name: "TextEdit",
      focused_app_bundle_id: "com.apple.TextEdit",
      focused_app_window_title: "Untitled",
      insertion_method: "none",
      insertion_status: "not_inserted",
      provider_asr: "unavailable",
      provider_llm: "unavailable",
      error_code: "server.refine_failed",
      timing_json: "{}"
    });
    const controller = createDictationSessionController(deps);

    const snapshot = await controller.retryHistoryRow("failed-1");

    expect(deps.readLocalRecording).toHaveBeenCalledWith("/tmp/failed-1.webm");
    expect(deps.backend).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: "session-1",
        audio: Buffer.from("retry-audio"),
        audioFormat: "webm",
        durationMs: 1800,
        context: expect.objectContaining({
          app_name: "TextEdit",
          bundle_id: "com.apple.TextEdit"
        })
      })
    );
    expect(deps.insertText).not.toHaveBeenCalled();
    expect(deps.copyText).toHaveBeenCalledWith("Tomorrow at three.");
    expect(deps.overlay.showCopied).toHaveBeenCalledWith({ sessionId: "session-1" });
    expect(historyRows[0]).toMatchObject({
      id: "session-1",
      status: "completed",
      audio_local_path: null,
      insertion_method: "clipboard",
      insertion_status: "copied"
    });
    expect(snapshot.state).toEqual({ status: "complete", sessionId: "session-1" });
  });

  it("does not try to delete a missing retry recording path when retention is never", async () => {
    const { deps, historyRows } = createDeps();
    deps.repositories.settings.getSettings.mockReturnValue({
      ...defaultSettings,
      historyRetention: "never"
    });
    deps.repositories.history.getHistoryRow.mockReturnValue({
      id: "failed-1",
      created_at: "2026-05-02T00:00:00.000Z",
      updated_at: "2026-05-02T00:00:00.000Z",
      status: "error",
      raw_text: "raw transcript",
      refined_text: "",
      audio_local_path: "/tmp/failed-1.webm",
      duration_ms: 1800,
      output_length: 14,
      language: "en",
      focused_app_name: "TextEdit",
      focused_app_bundle_id: "com.apple.TextEdit",
      focused_app_window_title: "Untitled",
      insertion_method: "none",
      insertion_status: "not_inserted",
      provider_asr: "unavailable",
      provider_llm: "unavailable",
      error_code: "server.refine_failed",
      timing_json: "{}"
    });
    const controller = createDictationSessionController(deps);

    await controller.retryHistoryRow("failed-1");

    expect(historyRows).toEqual([]);
    expect(deps.deleteLocalRecording).not.toHaveBeenCalled();
  });

  it("shows a retry unavailable error when the retained recording file cannot be read", async () => {
    const { deps } = createDeps();
    deps.readLocalRecording.mockRejectedValueOnce(new Error("ENOENT"));
    deps.repositories.history.getHistoryRow.mockReturnValue({
      id: "failed-1",
      created_at: "2026-05-02T00:00:00.000Z",
      updated_at: "2026-05-02T00:00:00.000Z",
      status: "error",
      raw_text: "raw transcript",
      refined_text: "",
      audio_local_path: "/tmp/missing.webm",
      duration_ms: 1800,
      output_length: 14,
      language: "en",
      focused_app_name: "TextEdit",
      focused_app_bundle_id: "com.apple.TextEdit",
      focused_app_window_title: "Untitled",
      insertion_method: "none",
      insertion_status: "not_inserted",
      provider_asr: "unavailable",
      provider_llm: "unavailable",
      error_code: "server.refine_failed",
      timing_json: "{}"
    });
    const controller = createDictationSessionController(deps);

    const snapshot = await controller.retryHistoryRow("failed-1");

    expect(deps.backend).not.toHaveBeenCalled();
    expect(deps.overlay.showError).toHaveBeenCalledWith({
      sessionId: "session-1",
      code: "history.retry_unavailable",
      message: "The retained recording could not be read. Try a new dictation."
    });
    expect(snapshot.state).toEqual({
      status: "error",
      sessionId: "session-1",
      code: "history.retry_unavailable",
      message: "The retained recording could not be read. Try a new dictation."
    });
  });

  it("explains retry requires failed or cancelled rows with retained audio", async () => {
    const { deps } = createDeps();
    deps.repositories.history.getHistoryRow.mockReturnValue({
      id: "cancelled-1",
      created_at: "2026-05-02T00:00:00.000Z",
      updated_at: "2026-05-02T00:00:00.000Z",
      status: "cancelled",
      raw_text: "",
      refined_text: "",
      audio_local_path: null,
      duration_ms: 0,
      output_length: 0,
      language: "en",
      focused_app_name: "TextEdit",
      focused_app_bundle_id: "com.apple.TextEdit",
      focused_app_window_title: "Untitled",
      insertion_method: "none",
      insertion_status: "not_inserted",
      provider_asr: "not_started",
      provider_llm: "not_started",
      error_code: "dictation.cancelled",
      timing_json: "{}"
    });
    const controller = createDictationSessionController(deps);

    const snapshot = await controller.retryHistoryRow("cancelled-1");

    expect(deps.readLocalRecording).not.toHaveBeenCalled();
    expect(deps.overlay.showError).toHaveBeenCalledWith({
      sessionId: "session-1",
      code: "history.retry_unavailable",
      message: "Retry is available only when a failed or cancelled recording is still retained locally."
    });
    expect(snapshot.state).toEqual({
      status: "error",
      sessionId: "session-1",
      code: "history.retry_unavailable",
      message: "Retry is available only when a failed or cancelled recording is still retained locally."
    });
  });
});
