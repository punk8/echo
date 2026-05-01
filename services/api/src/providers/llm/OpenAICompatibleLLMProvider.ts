import type { LLMCompletionInput, LLMCompletionResult, LLMProvider } from "./LLMProvider.js";

type FetchImpl = typeof fetch;

export interface OpenAICompatibleLLMProviderOptions {
  apiKey: string;
  baseUrl: string;
  model: string;
  fetchImpl?: FetchImpl;
}

export class OpenAICompatibleLLMProvider implements LLMProvider {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly model: string;
  private readonly fetchImpl: FetchImpl;

  constructor(options: OpenAICompatibleLLMProviderOptions) {
    this.apiKey = options.apiKey;
    this.baseUrl = options.baseUrl.replace(/\/+$/, "");
    this.model = options.model;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async complete(input: LLMCompletionInput): Promise<LLMCompletionResult> {
    const startedAt = performance.now();

    try {
      const response = await this.fetchImpl(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: this.model,
          messages: input.messages,
          temperature: input.temperature,
          response_format: { type: input.responseFormat }
        })
      });

      if (!response.ok) {
        throw providerStatusError(response.status);
      }

      const payload = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const content = payload.choices?.[0]?.message?.content;
      if (!content) {
        throw new Error("empty content");
      }

      return {
        content,
        provider: `openai-compatible:${this.model}`,
        durationMs: Math.round(performance.now() - startedAt)
      };
    } catch (error) {
      throw normalizeCompletionError(error);
    }
  }
}

function providerStatusError(status: number) {
  if (status === 429) {
    return new Error("server.provider_rate_limited");
  }
  if (status === 408 || status === 504) {
    return new Error("server.provider_timeout");
  }
  return new Error("server.refine_failed");
}

function normalizeCompletionError(error: unknown) {
  if (error instanceof Error) {
    if (
      error.message === "server.provider_rate_limited" ||
      error.message === "server.provider_timeout" ||
      error.message === "server.refine_failed"
    ) {
      return error;
    }
    if (error.name === "AbortError" || /timeout/i.test(error.message)) {
      return new Error("server.provider_timeout");
    }
  }

  return new Error("server.refine_failed");
}
