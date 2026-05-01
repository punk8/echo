import { describe, expect, it } from "vitest";
import { loadApiEnv } from "./env";

describe("loadApiEnv", () => {
  it("loads valid real provider configuration", () => {
    const env = loadApiEnv({
      API_HOST: "127.0.0.1",
      API_PORT: "43110",
      ASR_PROVIDER: "openai",
      ASR_MODEL: "gpt-4o-transcribe",
      ASR_BASE_URL: "https://api.openai.com/v1",
      ASR_API_KEY: "asr-secret",
      ASR_LANGUAGE: "auto",
      LLM_PROVIDER: "openai-compatible",
      LLM_MODEL: "gpt-4o",
      LLM_BASE_URL: "https://api.openai.com/v1",
      LLM_API_KEY: "llm-secret",
      LLM_TEMPERATURE: "0.2"
    });

    expect(env.asr.model).toBe("gpt-4o-transcribe");
    expect(env.llm.temperature).toBe(0.2);
  });

  it("rejects missing ASR key without logging the key value", () => {
    expect(() =>
      loadApiEnv({
        API_HOST: "127.0.0.1",
        API_PORT: "43110",
        ASR_PROVIDER: "openai",
        ASR_MODEL: "gpt-4o-transcribe",
        ASR_BASE_URL: "https://api.openai.com/v1",
        ASR_LANGUAGE: "auto",
        LLM_PROVIDER: "openai-compatible",
        LLM_MODEL: "gpt-4o",
        LLM_BASE_URL: "https://api.openai.com/v1",
        LLM_API_KEY: "llm-secret",
        LLM_TEMPERATURE: "0.2"
      })
    ).toThrow("config.asr_missing");
  });

  it("uses API_KEY as a local fallback for ASR and LLM keys", () => {
    const env = loadApiEnv({
      API_HOST: "127.0.0.1",
      API_PORT: "43110",
      API_KEY: "shared-secret",
      ASR_PROVIDER: "openai",
      ASR_MODEL: "gpt-4o-transcribe",
      ASR_BASE_URL: "https://api.openai.com/v1",
      ASR_LANGUAGE: "auto",
      LLM_PROVIDER: "openai-compatible",
      LLM_MODEL: "gpt-4o",
      LLM_BASE_URL: "https://api.openai.com/v1",
      LLM_TEMPERATURE: "0.2"
    });

    expect(env.asr.apiKey).toBe("shared-secret");
    expect(env.llm.apiKey).toBe("shared-secret");
  });
});
