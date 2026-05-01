import { describe, expect, it, vi } from "vitest";
import { BackendDictationError } from "./backendClient";
import { createDictationSessionController } from "./sessionController";

const context = {
  app_name: "TextEdit",
  bundle_id: "com.apple.TextEdit",
  window_title: "Untitled",
  writable: true,
  selection_present: false,
  nearby_text: ""
};

function createDeps() {
  const historyRows: unknown[] = [];
  return {
    historyRows,
    deps: {
      createSessionId: () => "session-1",
      now: () => "2026-05-02T00:00:00.000Z",
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
      overlay: {
        showRecording: vi.fn(),
        showProcessing: vi.fn(),
        showError: vi.fn(),
        showComplete: vi.fn(),
        hide: vi.fn()
      },
      repositories: {
        history: {
          insertHistoryRow: vi.fn((row: unknown) => historyRows.push(row)),
          updateInsertionStatus: vi.fn()
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
          getSettings: vi.fn(() => ({ historyRetention: "1_week" as const, shortcut: "Alt+Space", language: "auto" }))
        }
      }
    }
  };
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

  it("stopping from recording processes audio, inserts refined text, and writes history", async () => {
    const { deps, historyRows } = createDeps();
    const controller = createDictationSessionController(deps);

    await controller.startDictation();
    const snapshot = await controller.stopDictation();

    expect(deps.backend).toHaveBeenCalledWith(expect.objectContaining({ sessionId: "session-1", audioFormat: "webm" }));
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
      message: "Speech recognition failed."
    });
    expect(snapshot.state).toEqual({
      status: "error",
      sessionId: "session-1",
      code: "server.asr_failed",
      message: "Speech recognition failed."
    });
  });
});
