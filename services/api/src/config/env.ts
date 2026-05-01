import { z } from "zod";

const defaultOpenAIBaseUrl = "https://api.openai.com/v1";

const EnvSchema = z.object({
  API_HOST: z.string().default("127.0.0.1"),
  API_PORT: z.coerce.number().int().positive().default(43110),
  API_KEY: optionalNonEmptyString(),
  ASR_PROVIDER: stringWithDefault("openai").pipe(z.literal("openai")),
  ASR_MODEL: stringWithDefault("gpt-4o-transcribe").pipe(z.literal("gpt-4o-transcribe")),
  ASR_BASE_URL: stringWithDefault(defaultOpenAIBaseUrl).pipe(z.string().url()),
  ASR_API_KEY: optionalNonEmptyString("config.asr_key_missing"),
  ASR_LANGUAGE: z.string().default("auto"),
  LLM_PROVIDER: stringWithDefault("openai-compatible").pipe(z.literal("openai-compatible")),
  LLM_MODEL: requiredNonEmptyString("config.llm_model_missing"),
  LLM_BASE_URL: stringWithDefault(defaultOpenAIBaseUrl).pipe(z.string().url()),
  LLM_API_KEY: optionalNonEmptyString("config.llm_key_missing"),
  LLM_TEMPERATURE: z.coerce.number().min(0).max(1).default(0.2)
});

export type ApiEnv = ReturnType<typeof loadApiEnv>;

export function loadApiEnv(input: NodeJS.ProcessEnv) {
  const parsed = EnvSchema.safeParse(input);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    throw new Error(first?.message ?? "config.invalid");
  }

  const asrApiKey = parsed.data.ASR_API_KEY ?? parsed.data.API_KEY;
  if (!asrApiKey) {
    throw new Error("config.asr_key_missing");
  }

  const llmApiKey = parsed.data.LLM_API_KEY ?? parsed.data.API_KEY;
  if (!llmApiKey) {
    throw new Error("config.llm_key_missing");
  }

  return {
    server: {
      host: parsed.data.API_HOST,
      port: parsed.data.API_PORT
    },
    asr: {
      provider: parsed.data.ASR_PROVIDER,
      model: parsed.data.ASR_MODEL,
      baseUrl: parsed.data.ASR_BASE_URL,
      apiKey: asrApiKey,
      language: parsed.data.ASR_LANGUAGE
    },
    llm: {
      provider: parsed.data.LLM_PROVIDER,
      model: parsed.data.LLM_MODEL,
      baseUrl: parsed.data.LLM_BASE_URL,
      apiKey: llmApiKey,
      temperature: parsed.data.LLM_TEMPERATURE
    }
  } as const;
}

function optionalNonEmptyString(message = "config.invalid") {
  return z.preprocess((value) => normalizeBlank(value), z.string().min(1, message).optional());
}

function requiredNonEmptyString(message: string) {
  return z.preprocess((value) => normalizeBlank(value), z.string({ required_error: message }).min(1, message));
}

function stringWithDefault(defaultValue: string) {
  return z.preprocess((value) => normalizeBlank(value) ?? defaultValue, z.string());
}

function normalizeBlank(value: unknown) {
  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();
  if (!trimmed || trimmed === "默认" || trimmed.toLowerCase() === "default") {
    return undefined;
  }

  return trimmed;
}
