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
});
