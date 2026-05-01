import { z } from "zod";

const EnvSchema = z.object({
  API_HOST: z.string().default("127.0.0.1"),
  API_PORT: z.coerce.number().int().positive().default(43110),
  ASR_PROVIDER: z.literal("openai"),
  ASR_MODEL: z.literal("gpt-4o-transcribe"),
  ASR_BASE_URL: z.string().url(),
  ASR_API_KEY: z.string({ required_error: "config.asr_missing" }).min(1, "config.asr_missing"),
  ASR_LANGUAGE: z.string().default("auto"),
  LLM_PROVIDER: z.literal("openai-compatible"),
  LLM_MODEL: z.string().min(1, "config.llm_missing"),
  LLM_BASE_URL: z.string().url(),
  LLM_API_KEY: z.string({ required_error: "config.llm_missing" }).min(1, "config.llm_missing"),
  LLM_TEMPERATURE: z.coerce.number().min(0).max(1).default(0.2)
});

export type ApiEnv = ReturnType<typeof loadApiEnv>;

export function loadApiEnv(input: NodeJS.ProcessEnv) {
  const parsed = EnvSchema.safeParse(input);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    throw new Error(first?.message ?? "config.invalid");
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
      apiKey: parsed.data.ASR_API_KEY,
      language: parsed.data.ASR_LANGUAGE
    },
    llm: {
      provider: parsed.data.LLM_PROVIDER,
      model: parsed.data.LLM_MODEL,
      baseUrl: parsed.data.LLM_BASE_URL,
      apiKey: parsed.data.LLM_API_KEY,
      temperature: parsed.data.LLM_TEMPERATURE
    }
  } as const;
}
