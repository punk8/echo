import type { LLMCompletionInput, LLMCompletionResult, LLMProvider } from "./LLMProvider";

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
        throw new Error("provider error");
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
    } catch {
      throw new Error("server.refine_failed");
    }
  }
}
