import OpenAI from "openai";
import type { ASRInput, ASRProvider, ASRResult } from "./ASRProvider";

type TranscriptionClient = {
  audio: {
    transcriptions: {
      create(input: Record<string, unknown>): Promise<{ text?: string }>;
    };
  };
};

export interface OpenAITranscribeProviderOptions {
  apiKey: string;
  baseUrl: string;
  model: "gpt-4o-transcribe";
  client?: TranscriptionClient;
}

export class OpenAITranscribeProvider implements ASRProvider {
  private readonly client: TranscriptionClient;
  private readonly model: "gpt-4o-transcribe";

  constructor(options: OpenAITranscribeProviderOptions) {
    this.model = options.model;
    this.client =
      options.client ??
      (new OpenAI({
        apiKey: options.apiKey,
        baseURL: options.baseUrl
      }) as unknown as TranscriptionClient);
  }

  async transcribe(input: ASRInput): Promise<ASRResult> {
    const startedAt = performance.now();
    try {
      const arrayBuffer = input.audio.buffer.slice(
        input.audio.byteOffset,
        input.audio.byteOffset + input.audio.byteLength
      ) as ArrayBuffer;
      const file = new File([arrayBuffer], input.filename, { type: input.mimeType });
      const request: Record<string, unknown> = {
        file,
        model: this.model
      };

      if (input.prompt) {
        request.prompt = input.prompt;
      }

      if (input.language !== "auto") {
        request.language = input.language;
      }

      const response = await this.client.audio.transcriptions.create(request);
      if (!response.text) {
        throw new Error("empty transcription");
      }

      return {
        rawText: response.text,
        language: input.language,
        provider: `openai:${this.model}`,
        durationMs: Math.round(performance.now() - startedAt)
      };
    } catch {
      throw new Error("server.asr_failed");
    }
  }
}
