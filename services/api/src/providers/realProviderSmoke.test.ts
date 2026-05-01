import { describe, expect, it } from "vitest";
import { loadApiEnv } from "../config/env";
import { OpenAITranscribeProvider } from "./asr/OpenAITranscribeProvider";
import { OpenAICompatibleLLMProvider } from "./llm/OpenAICompatibleLLMProvider";

const runReal = process.env.RUN_REAL_PROVIDER_TESTS === "1";

describe.skipIf(!runReal)("real providers", () => {
  it("requires local provider configuration", () => {
    const env = loadApiEnv(process.env);

    expect(env.asr.model).toBe("gpt-4o-transcribe");
    expect(env.llm.model.length).toBeGreaterThan(0);
  });

  it("constructs real provider instances", () => {
    const env = loadApiEnv(process.env);
    const asr = new OpenAITranscribeProvider(env.asr);
    const llm = new OpenAICompatibleLLMProvider(env.llm);

    expect(asr).toBeDefined();
    expect(llm).toBeDefined();
  });
});
