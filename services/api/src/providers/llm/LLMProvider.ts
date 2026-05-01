export interface LLMMessage {
  role: "system" | "user";
  content: string;
}

export interface LLMCompletionInput {
  messages: LLMMessage[];
  temperature: number;
  responseFormat: "json_object";
}

export interface LLMCompletionResult {
  content: string;
  provider: string;
  durationMs?: number;
}

export interface LLMProvider {
  complete(input: LLMCompletionInput): Promise<LLMCompletionResult>;
}
