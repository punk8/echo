import { describe, expect, it, vi } from "vitest";
import { OpenAITranscribeProvider } from "./OpenAITranscribeProvider";

describe("OpenAITranscribeProvider", () => {
  it("sends audio to the configured transcription model", async () => {
    const create = vi.fn().mockResolvedValue({ text: "hello world" });
    const provider = new OpenAITranscribeProvider({
      apiKey: "secret",
      baseUrl: "https://api.openai.com/v1",
      model: "gpt-4o-transcribe",
      client: {
        audio: {
          transcriptions: {
            create
          }
        }
      }
    });

    const result = await provider.transcribe({
      audio: Buffer.from("audio"),
      filename: "dictation.webm",
      mimeType: "audio/webm",
      language: "auto",
      prompt: "User dictionary: Echo"
    });

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "gpt-4o-transcribe",
        prompt: "User dictionary: Echo"
      })
    );
    expect(result.rawText).toBe("hello world");
    expect(result.provider).toBe("openai:gpt-4o-transcribe");
  });

  it("maps provider failure to server.asr_failed", async () => {
    const create = vi.fn().mockRejectedValue(new Error("network down"));
    const provider = new OpenAITranscribeProvider({
      apiKey: "secret",
      baseUrl: "https://api.openai.com/v1",
      model: "gpt-4o-transcribe",
      client: {
        audio: {
          transcriptions: {
            create
          }
        }
      }
    });

    await expect(
      provider.transcribe({
        audio: Buffer.from("audio"),
        filename: "dictation.wav",
        mimeType: "audio/wav",
        language: "auto"
      })
    ).rejects.toThrow("server.asr_failed");
  });

  it("maps empty transcription to audio.no_speech_detected", async () => {
    const provider = new OpenAITranscribeProvider({
      apiKey: "secret",
      baseUrl: "https://api.openai.com/v1",
      model: "gpt-4o-transcribe",
      client: {
        audio: {
          transcriptions: {
            create: vi.fn().mockResolvedValue({ text: "" })
          }
        }
      }
    });

    await expect(
      provider.transcribe({
        audio: Buffer.from("audio"),
        filename: "dictation.wav",
        mimeType: "audio/wav",
        language: "auto"
      })
    ).rejects.toThrow("audio.no_speech_detected");
  });

  it("maps rate limits and timeouts to specific provider errors", async () => {
    const rateLimited = new OpenAITranscribeProvider({
      apiKey: "secret",
      baseUrl: "https://api.openai.com/v1",
      model: "gpt-4o-transcribe",
      client: {
        audio: {
          transcriptions: {
            create: vi.fn().mockRejectedValue(Object.assign(new Error("rate limited"), { status: 429 }))
          }
        }
      }
    });
    const timedOut = new OpenAITranscribeProvider({
      apiKey: "secret",
      baseUrl: "https://api.openai.com/v1",
      model: "gpt-4o-transcribe",
      client: {
        audio: {
          transcriptions: {
            create: vi.fn().mockRejectedValue(Object.assign(new Error("timeout"), { name: "AbortError" }))
          }
        }
      }
    });

    await expect(
      rateLimited.transcribe({
        audio: Buffer.from("audio"),
        filename: "dictation.wav",
        mimeType: "audio/wav",
        language: "auto"
      })
    ).rejects.toThrow("server.provider_rate_limited");
    await expect(
      timedOut.transcribe({
        audio: Buffer.from("audio"),
        filename: "dictation.wav",
        mimeType: "audio/wav",
        language: "auto"
      })
    ).rejects.toThrow("server.provider_timeout");
  });
});
