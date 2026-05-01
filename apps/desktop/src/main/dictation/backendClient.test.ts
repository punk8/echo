import { describe, expect, it, vi } from "vitest";
import { BackendDictationError, processDictation } from "./backendClient";

describe("processDictation", () => {
  it("posts audio and metadata to the dictation process endpoint", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
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
        quality: { risk: "low", warnings: [] }
      })
    });

    const result = await processDictation({
      apiBaseUrl: "http://127.0.0.1:43110",
      fetchImpl,
      sessionId: "session-1",
      audio: Buffer.from("audio"),
      audioFormat: "webm",
      durationMs: 1200,
      language: "auto",
      context: {
        app_name: "TextEdit",
        bundle_id: "com.apple.TextEdit",
        window_title: "Untitled",
        writable: true,
        selection_present: false,
        nearby_text: ""
      },
      dictionary: [{ term: "Echo", aliases: [], case_sensitive: true, source: "manual" }],
      preferences: { style: "balanced", output_language: "follow_input", format_lists: true }
    });

    const [, init] = fetchImpl.mock.calls[0]!;
    const body = init.body as FormData;

    expect(fetchImpl).toHaveBeenCalledWith("http://127.0.0.1:43110/v1/dictation/process", expect.any(Object));
    expect(init.method).toBe("POST");
    expect(body.get("session_id")).toBe("session-1");
    expect(body.get("audio_format")).toBe("webm");
    expect(body.get("language")).toBe("auto");
    expect(JSON.parse(String(body.get("dictionary")))).toEqual([
      { term: "Echo", aliases: [], case_sensitive: true, source: "manual" }
    ]);
    expect(result.refined_text).toBe("Tomorrow at three.");
  });

  it("throws server error codes from error responses", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({
        session_id: "session-1",
        error: { code: "server.asr_failed", message: "Speech recognition failed.", recoverable: true },
        raw_text: ""
      })
    });

    await expect(
      processDictation({
        apiBaseUrl: "http://127.0.0.1:43110",
        fetchImpl,
        sessionId: "session-1",
        audio: Buffer.from("audio"),
        audioFormat: "wav",
        durationMs: 1000,
        language: "auto",
        context: {
          app_name: "TextEdit",
          bundle_id: "com.apple.TextEdit",
          window_title: "Untitled",
          writable: true,
          selection_present: false,
          nearby_text: ""
        },
        dictionary: [],
        preferences: { style: "balanced", output_language: "follow_input", format_lists: true }
      })
    ).rejects.toMatchObject({ code: "server.asr_failed", rawText: "" } satisfies Partial<BackendDictationError>);
  });
});
