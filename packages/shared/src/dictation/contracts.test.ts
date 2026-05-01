import { describe, expect, it } from "vitest";
import { DictationProcessRequestSchema, DictationSuccessResponseSchema } from "./contracts";

describe("dictation contracts", () => {
  it("accepts the real-provider dictation request shape", () => {
    const result = DictationProcessRequestSchema.parse({
      session_id: "session-1",
      audio_format: "webm",
      duration_ms: 7200,
      language: "auto",
      context: {
        app_name: "TextEdit",
        bundle_id: "com.apple.TextEdit",
        window_title: "Untitled",
        focused_role: "AXTextArea",
        writable: true,
        selection_present: false,
        nearby_text: ""
      },
      dictionary: [
        {
          term: "Echo",
          aliases: [],
          case_sensitive: true,
          source: "manual",
          pronunciation_hint: "EH-koh",
          capitalization: "Echo",
          language: "en"
        }
      ],
      preferences: {
        style: "balanced",
        output_language: "follow_input",
        format_lists: true
      }
    });

    expect(result.audio_format).toBe("webm");
    expect(result.dictionary[0]?.term).toBe("Echo");
    expect(result.dictionary[0]?.pronunciation_hint).toBe("EH-koh");
    expect(result.dictionary[0]?.capitalization).toBe("Echo");
    expect(result.dictionary[0]?.language).toBe("en");
    expect(result.context.focused_role).toBe("AXTextArea");
  });

  it("rejects unsupported audio formats before provider calls", () => {
    expect(() =>
      DictationProcessRequestSchema.parse({
        session_id: "session-1",
        audio_format: "ogg",
        duration_ms: 1000,
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
        preferences: {
          style: "balanced",
          output_language: "follow_input",
          format_lists: true
        }
      })
    ).toThrow();
  });

  it("accepts provider metadata on successful responses", () => {
    const result = DictationSuccessResponseSchema.parse({
      session_id: "session-1",
      raw_text: "um tomorrow at seven no make it three",
      refined_text: "Tomorrow at three.",
      language: "en",
      provider: {
        asr: "openai:gpt-4o-transcribe",
        llm: "openai-compatible:gpt-4o"
      },
      timing: {
        upload_received_at: "2026-05-02T12:00:00.000Z",
        asr_ms: 1200,
        refine_ms: 800,
        total_ms: 2100
      },
      quality: {
        risk: "low",
        warnings: []
      }
    });

    expect(result.refined_text).toBe("Tomorrow at three.");
  });
});
