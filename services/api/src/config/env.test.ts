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

  it("rejects missing ASR key with a specific config error", () => {
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
    ).toThrow("config.asr_key_missing");
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

  it("ignores .env.example secret placeholders when shared API_KEY is set", () => {
    const env = loadApiEnv({
      API_KEY: "shared-secret",
      ASR_API_KEY: "replace-with-local-secret",
      LLM_API_KEY: "replace-with-local-secret",
      LLM_MODEL: "gpt-4o"
    });

    expect(env.asr.apiKey).toBe("shared-secret");
    expect(env.llm.apiKey).toBe("shared-secret");
  });

  it("defaults blank local placeholders for OpenAI-compatible development", () => {
    const env = loadApiEnv({
      API_KEY: "shared-secret",
      ASR_PROVIDER: "",
      ASR_MODEL: "",
      ASR_BASE_URL: "默认",
      LLM_PROVIDER: "",
      LLM_MODEL: "gpt-4o",
      LLM_BASE_URL: "默认"
    });

    expect(env.asr.provider).toBe("openai");
    expect(env.asr.model).toBe("gpt-4o-transcribe");
    expect(env.asr.baseUrl).toBe("https://api.openai.com/v1");
    expect(env.llm.provider).toBe("openai-compatible");
    expect(env.llm.baseUrl).toBe("https://api.openai.com/v1");
  });

  it("keeps LLM model explicit even when other placeholders have defaults", () => {
    expect(() =>
      loadApiEnv({
        API_KEY: "shared-secret",
        ASR_PROVIDER: "",
        ASR_MODEL: "",
        ASR_BASE_URL: "默认",
        LLM_PROVIDER: "",
        LLM_MODEL: "replace-with-model-id",
        LLM_BASE_URL: "默认"
      })
    ).toThrow("config.llm_model_missing");
  });

  it("rejects missing LLM key with a specific config error", () => {
    expect(() =>
      loadApiEnv({
        ASR_API_KEY: "asr-secret",
        LLM_MODEL: "gpt-4o"
      })
    ).toThrow("config.llm_key_missing");
  });
});
