import { describe, expect, it } from "vitest";
import { buildServer } from "../server";

function multipartBody(parts: Array<{ name: string; value: string } | { name: string; filename: string; contentType: string; value: string }>) {
  const boundary = "----echo-test-boundary";
  const body = parts
    .map((part) => {
      if ("filename" in part) {
        return [
          `--${boundary}`,
          `Content-Disposition: form-data; name="${part.name}"; filename="${part.filename}"`,
          `Content-Type: ${part.contentType}`,
          "",
          part.value
        ].join("\r\n");
      }

      return [`--${boundary}`, `Content-Disposition: form-data; name="${part.name}"`, "", part.value].join("\r\n");
    })
    .concat(`--${boundary}--`)
    .join("\r\n");

  return {
    body,
    headers: {
      "content-type": `multipart/form-data; boundary=${boundary}`
    }
  };
}

describe("POST /v1/dictation/process", () => {
  it("returns refined text with provider metadata", async () => {
    const app = buildServer({
      asr: {
        transcribe: async () => ({
          rawText: "um tomorrow at seven no make it three",
          language: "en",
          provider: "openai:gpt-4o-transcribe",
          durationMs: 12
        })
      },
      llm: {
        complete: async () => ({
          content:
            "{\"refined_text\":\"Tomorrow at three.\",\"language\":\"en\",\"edits\":[\"resolved correction\"],\"risk\":\"low\",\"warnings\":[]}",
          provider: "openai-compatible:gpt-4o",
          durationMs: 8
        })
      }
    });

    const multipart = multipartBody([
      { name: "session_id", value: "session-1" },
      { name: "audio_format", value: "webm" },
      { name: "duration_ms", value: "1200" },
      { name: "language", value: "auto" },
      {
        name: "context",
        value: JSON.stringify({
          app_name: "TextEdit",
          bundle_id: "com.apple.TextEdit",
          window_title: "Untitled",
          writable: true,
          selection_present: false,
          nearby_text: ""
        })
      },
      {
        name: "dictionary",
        value: JSON.stringify([{ term: "Echo", aliases: [], case_sensitive: true, source: "manual" }])
      },
      {
        name: "preferences",
        value: JSON.stringify({ style: "balanced", output_language: "follow_input", format_lists: true })
      },
      { name: "audio", filename: "dictation.webm", contentType: "audio/webm", value: "audio-bytes" }
    ]);

    const response = await app.inject({
      method: "POST",
      url: "/v1/dictation/process",
      payload: multipart.body,
      headers: multipart.headers
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().refined_text).toBe("Tomorrow at three.");
    expect(response.json().provider.asr).toBe("openai:gpt-4o-transcribe");
  });

  it("passes dictionary aliases, pronunciation, capitalization, and language to ASR prompt", async () => {
    let asrPrompt = "";
    const app = buildServer({
      asr: {
        transcribe: async (input) => {
          asrPrompt = input.prompt ?? "";
          return {
            rawText: "use Echo today",
            language: "en",
            provider: "openai:gpt-4o-transcribe",
            durationMs: 12
          };
        }
      },
      llm: {
        complete: async () => ({
          content: "{\"refined_text\":\"Use Echo today.\",\"language\":\"en\",\"edits\":[],\"risk\":\"low\",\"warnings\":[]}",
          provider: "openai-compatible:gpt-4o",
          durationMs: 8
        })
      }
    });

    const multipart = multipartBody([
      { name: "session_id", value: "session-1" },
      { name: "audio_format", value: "webm" },
      { name: "duration_ms", value: "1200" },
      { name: "language", value: "auto" },
      {
        name: "context",
        value: JSON.stringify({
          app_name: "TextEdit",
          bundle_id: "com.apple.TextEdit",
          window_title: "Untitled",
          writable: true,
          selection_present: false,
          nearby_text: ""
        })
      },
      {
        name: "dictionary",
        value: JSON.stringify([
          {
            term: "Echo",
            aliases: ["Echo app"],
            case_sensitive: true,
            source: "manual",
            pronunciation_hint: "EH-koh",
            capitalization: "Echo",
            language: "en"
          }
        ])
      },
      {
        name: "preferences",
        value: JSON.stringify({ style: "balanced", output_language: "follow_input", format_lists: true })
      },
      { name: "audio", filename: "dictation.webm", contentType: "audio/webm", value: "audio-bytes" }
    ]);

    await app.inject({
      method: "POST",
      url: "/v1/dictation/process",
      payload: multipart.body,
      headers: multipart.headers
    });

    expect(asrPrompt).toContain("Echo");
    expect(asrPrompt).toContain("aliases=Echo app");
    expect(asrPrompt).toContain("pronunciation=EH-koh");
    expect(asrPrompt).toContain("capitalization=Echo");
    expect(asrPrompt).toContain("language=en");
  });

  it("returns raw transcript for recovery when refinement fails after ASR succeeds", async () => {
    const app = buildServer({
      asr: {
        transcribe: async () => ({
          rawText: "um tomorrow at seven no make it three",
          language: "en",
          provider: "openai:gpt-4o-transcribe",
          durationMs: 12
        })
      },
      llm: {
        complete: async () => {
          throw new Error("server.refine_failed");
        }
      }
    });

    const multipart = multipartBody([
      { name: "session_id", value: "session-1" },
      { name: "audio_format", value: "webm" },
      { name: "duration_ms", value: "1200" },
      { name: "language", value: "auto" },
      {
        name: "context",
        value: JSON.stringify({
          app_name: "TextEdit",
          bundle_id: "com.apple.TextEdit",
          window_title: "Untitled",
          writable: true,
          selection_present: false,
          nearby_text: ""
        })
      },
      {
        name: "dictionary",
        value: JSON.stringify([{ term: "Echo", aliases: [], case_sensitive: true, source: "manual" }])
      },
      {
        name: "preferences",
        value: JSON.stringify({ style: "balanced", output_language: "follow_input", format_lists: true })
      },
      { name: "audio", filename: "dictation.webm", contentType: "audio/webm", value: "audio-bytes" }
    ]);

    const response = await app.inject({
      method: "POST",
      url: "/v1/dictation/process",
      payload: multipart.body,
      headers: multipart.headers
    });

    expect(response.statusCode).toBe(500);
    expect(response.json()).toMatchObject({
      session_id: "session-1",
      error: {
        code: "server.refine_failed",
        message: "Dictation refinement failed.",
        recoverable: true
      },
      raw_text: "um tomorrow at seven no make it three"
    });
  });

  it("returns no-speech when ASR produces an empty transcript", async () => {
    let llmCalled = false;
    const app = buildServer({
      asr: {
        transcribe: async () => ({
          rawText: "   ",
          language: "en",
          provider: "openai:gpt-4o-transcribe",
          durationMs: 12
        })
      },
      llm: {
        complete: async () => {
          llmCalled = true;
          return {
            content: "{\"refined_text\":\"\",\"language\":\"en\",\"edits\":[],\"risk\":\"low\",\"warnings\":[]}",
            provider: "openai-compatible:gpt-4o",
            durationMs: 8
          };
        }
      }
    });

    const multipart = multipartBody([
      { name: "session_id", value: "session-1" },
      { name: "audio_format", value: "webm" },
      { name: "duration_ms", value: "1200" },
      { name: "language", value: "auto" },
      {
        name: "context",
        value: JSON.stringify({
          app_name: "TextEdit",
          bundle_id: "com.apple.TextEdit",
          window_title: "Untitled",
          writable: true,
          selection_present: false,
          nearby_text: ""
        })
      },
      {
        name: "dictionary",
        value: JSON.stringify([{ term: "Echo", aliases: [], case_sensitive: true, source: "manual" }])
      },
      {
        name: "preferences",
        value: JSON.stringify({ style: "balanced", output_language: "follow_input", format_lists: true })
      },
      { name: "audio", filename: "dictation.webm", contentType: "audio/webm", value: "audio-bytes" }
    ]);

    const response = await app.inject({
      method: "POST",
      url: "/v1/dictation/process",
      payload: multipart.body,
      headers: multipart.headers
    });

    expect(response.statusCode).toBe(422);
    expect(response.json()).toMatchObject({
      session_id: "session-1",
      error: {
        code: "audio.no_speech_detected",
        message: "No speech was detected. Try again closer to the microphone.",
        recoverable: true
      },
      raw_text: "   "
    });
    expect(llmCalled).toBe(false);
  });

  it("returns poor audio quality when ASR cannot understand noisy audio", async () => {
    let llmCalled = false;
    const app = buildServer({
      asr: {
        transcribe: async () => {
          throw new Error("audio.poor_quality");
        }
      },
      llm: {
        complete: async () => {
          llmCalled = true;
          throw new Error("server.refine_failed");
        }
      }
    });

    const multipart = multipartBody([
      { name: "session_id", value: "session-1" },
      { name: "audio_format", value: "webm" },
      { name: "duration_ms", value: "1200" },
      { name: "language", value: "auto" },
      {
        name: "context",
        value: JSON.stringify({
          app_name: "TextEdit",
          bundle_id: "com.apple.TextEdit",
          window_title: "Untitled",
          writable: true,
          selection_present: false,
          nearby_text: ""
        })
      },
      {
        name: "dictionary",
        value: JSON.stringify([{ term: "Echo", aliases: [], case_sensitive: true, source: "manual" }])
      },
      {
        name: "preferences",
        value: JSON.stringify({ style: "balanced", output_language: "follow_input", format_lists: true })
      },
      { name: "audio", filename: "dictation.webm", contentType: "audio/webm", value: "audio-bytes" }
    ]);

    const response = await app.inject({
      method: "POST",
      url: "/v1/dictation/process",
      payload: multipart.body,
      headers: multipart.headers
    });

    expect(response.statusCode).toBe(422);
    expect(response.json()).toMatchObject({
      session_id: "session-1",
      error: {
        code: "audio.poor_quality",
        message: "Audio quality was too poor to transcribe. Move closer to the microphone and try again.",
        recoverable: true
      },
      raw_text: ""
    });
    expect(llmCalled).toBe(false);
  });

  it("rejects audio that exceeds the configured request limit before provider calls", async () => {
    let asrCalled = false;
    const app = buildServer({
      maxAudioBytes: 4,
      asr: {
        transcribe: async () => {
          asrCalled = true;
          return {
            rawText: "hello",
            language: "en",
            provider: "openai:gpt-4o-transcribe",
            durationMs: 12
          };
        }
      },
      llm: {
        complete: async () => {
          throw new Error("server.refine_failed");
        }
      }
    });

    const multipart = multipartBody([
      { name: "session_id", value: "session-1" },
      { name: "audio_format", value: "webm" },
      { name: "duration_ms", value: "1200" },
      { name: "language", value: "auto" },
      {
        name: "context",
        value: JSON.stringify({
          app_name: "TextEdit",
          bundle_id: "com.apple.TextEdit",
          window_title: "Untitled",
          writable: true,
          selection_present: false,
          nearby_text: ""
        })
      },
      {
        name: "dictionary",
        value: JSON.stringify([{ term: "Echo", aliases: [], case_sensitive: true, source: "manual" }])
      },
      {
        name: "preferences",
        value: JSON.stringify({ style: "balanced", output_language: "follow_input", format_lists: true })
      },
      { name: "audio", filename: "dictation.webm", contentType: "audio/webm", value: "audio-bytes" }
    ]);

    const response = await app.inject({
      method: "POST",
      url: "/v1/dictation/process",
      payload: multipart.body,
      headers: multipart.headers
    });

    expect(response.statusCode).toBe(413);
    expect(response.json().error).toMatchObject({
      code: "server.audio_too_large",
      message: "Recording is too large. Try a shorter dictation."
    });
    expect(asrCalled).toBe(false);
  });

  it("rejects invalid duration values before provider calls", async () => {
    let asrCalled = false;
    const app = buildServer({
      asr: {
        transcribe: async () => {
          asrCalled = true;
          return {
            rawText: "hello",
            language: "en",
            provider: "openai:gpt-4o-transcribe",
            durationMs: 12
          };
        }
      },
      llm: {
        complete: async () => {
          throw new Error("server.refine_failed");
        }
      }
    });

    const multipart = multipartBody([
      { name: "session_id", value: "session-1" },
      { name: "audio_format", value: "webm" },
      { name: "duration_ms", value: "-1" },
      { name: "language", value: "auto" },
      {
        name: "context",
        value: JSON.stringify({
          app_name: "TextEdit",
          bundle_id: "com.apple.TextEdit",
          window_title: "Untitled",
          writable: true,
          selection_present: false,
          nearby_text: ""
        })
      },
      {
        name: "dictionary",
        value: JSON.stringify([{ term: "Echo", aliases: [], case_sensitive: true, source: "manual" }])
      },
      {
        name: "preferences",
        value: JSON.stringify({ style: "balanced", output_language: "follow_input", format_lists: true })
      },
      { name: "audio", filename: "dictation.webm", contentType: "audio/webm", value: "audio-bytes" }
    ]);

    const response = await app.inject({
      method: "POST",
      url: "/v1/dictation/process",
      payload: multipart.body,
      headers: multipart.headers
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error).toMatchObject({
      code: "server.invalid_duration",
      message: "Invalid recording duration."
    });
    expect(asrCalled).toBe(false);
  });

  it("rejects malformed JSON request fields before provider calls", async () => {
    let asrCalled = false;
    const app = buildServer({
      asr: {
        transcribe: async () => {
          asrCalled = true;
          return {
            rawText: "hello",
            language: "en",
            provider: "openai:gpt-4o-transcribe",
            durationMs: 12
          };
        }
      },
      llm: {
        complete: async () => {
          throw new Error("server.refine_failed");
        }
      }
    });

    const multipart = multipartBody([
      { name: "session_id", value: "session-1" },
      { name: "audio_format", value: "webm" },
      { name: "duration_ms", value: "1200" },
      { name: "language", value: "auto" },
      { name: "context", value: "{not-json" },
      {
        name: "dictionary",
        value: JSON.stringify([{ term: "Echo", aliases: [], case_sensitive: true, source: "manual" }])
      },
      {
        name: "preferences",
        value: JSON.stringify({ style: "balanced", output_language: "follow_input", format_lists: true })
      },
      { name: "audio", filename: "dictation.webm", contentType: "audio/webm", value: "audio-bytes" }
    ]);

    const response = await app.inject({
      method: "POST",
      url: "/v1/dictation/process",
      payload: multipart.body,
      headers: multipart.headers
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error).toMatchObject({
      code: "server.invalid_request",
      message: "Invalid dictation request."
    });
    expect(asrCalled).toBe(false);
  });

  it("rejects requests without audio before provider calls", async () => {
    let asrCalled = false;
    const app = buildServer({
      asr: {
        transcribe: async () => {
          asrCalled = true;
          return {
            rawText: "hello",
            language: "en",
            provider: "openai:gpt-4o-transcribe",
            durationMs: 12
          };
        }
      },
      llm: {
        complete: async () => {
          throw new Error("server.refine_failed");
        }
      }
    });

    const multipart = multipartBody([
      { name: "session_id", value: "session-1" },
      { name: "audio_format", value: "webm" },
      { name: "duration_ms", value: "1200" },
      { name: "language", value: "auto" },
      {
        name: "context",
        value: JSON.stringify({
          app_name: "TextEdit",
          bundle_id: "com.apple.TextEdit",
          window_title: "Untitled",
          writable: true,
          selection_present: false,
          nearby_text: ""
        })
      },
      {
        name: "dictionary",
        value: JSON.stringify([{ term: "Echo", aliases: [], case_sensitive: true, source: "manual" }])
      },
      {
        name: "preferences",
        value: JSON.stringify({ style: "balanced", output_language: "follow_input", format_lists: true })
      }
    ]);

    const response = await app.inject({
      method: "POST",
      url: "/v1/dictation/process",
      payload: multipart.body,
      headers: multipart.headers
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error).toMatchObject({
      code: "server.invalid_request",
      message: "Invalid dictation request."
    });
    expect(asrCalled).toBe(false);
  });

  it("returns specific messages for provider rate limits", async () => {
    const app = buildServer({
      asr: {
        transcribe: async () => {
          throw new Error("server.provider_rate_limited");
        }
      },
      llm: {
        complete: async () => {
          throw new Error("server.refine_failed");
        }
      }
    });

    const multipart = multipartBody([
      { name: "session_id", value: "session-1" },
      { name: "audio_format", value: "webm" },
      { name: "duration_ms", value: "1200" },
      { name: "language", value: "auto" },
      {
        name: "context",
        value: JSON.stringify({
          app_name: "TextEdit",
          bundle_id: "com.apple.TextEdit",
          window_title: "Untitled",
          writable: true,
          selection_present: false,
          nearby_text: ""
        })
      },
      {
        name: "dictionary",
        value: JSON.stringify([{ term: "Echo", aliases: [], case_sensitive: true, source: "manual" }])
      },
      {
        name: "preferences",
        value: JSON.stringify({ style: "balanced", output_language: "follow_input", format_lists: true })
      },
      { name: "audio", filename: "dictation.webm", contentType: "audio/webm", value: "audio-bytes" }
    ]);

    const response = await app.inject({
      method: "POST",
      url: "/v1/dictation/process",
      payload: multipart.body,
      headers: multipart.headers
    });

    expect(response.statusCode).toBe(429);
    expect(response.json().error).toMatchObject({
      code: "server.provider_rate_limited",
      message: "Provider rate limit reached. Try again shortly."
    });
  });
});
