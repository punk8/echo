import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import { loadDotenv } from "../config/dotenv";
import { loadApiEnv } from "../config/env";
import { buildDictationPrompt } from "../refiner/buildDictationPrompt";
import { validateRefinedResult } from "../refiner/validateRefinedResult";
import { OpenAITranscribeProvider } from "./asr/OpenAITranscribeProvider";
import { OpenAICompatibleLLMProvider } from "./llm/OpenAICompatibleLLMProvider";

const runReal = process.env.RUN_REAL_PROVIDER_TESTS === "1";
const execFileAsync = promisify(execFile);
const smokeUtterance = "Let's meet tomorrow at seven, no actually make that three.";

describe.skipIf(!runReal)("real providers", () => {
  it("requires local provider configuration", () => {
    const env = loadRealProviderEnv();

    expect(env.asr.model).toBe("gpt-4o-transcribe");
    expect(env.llm.model.length).toBeGreaterThan(0);
  });

  it("constructs real provider instances", () => {
    const env = loadRealProviderEnv();
    const asr = new OpenAITranscribeProvider(env.asr);
    const llm = new OpenAICompatibleLLMProvider(env.llm);

    expect(asr).toBeDefined();
    expect(llm).toBeDefined();
  });

  it(
    "transcribes a generated spoken wav fixture with the real ASR provider",
    async () => {
      const env = loadRealProviderEnv();
      const asr = new OpenAITranscribeProvider(env.asr);
      const wavPath = await createSpokenWavFixture(smokeUtterance);

      try {
        const audio = await readFile(wavPath);
        const result = await asr.transcribe({
          audio,
          filename: "echo-real-provider-smoke.wav",
          mimeType: "audio/wav",
          language: "en",
          prompt: "The speaker says: Let's meet tomorrow at seven, no actually make that three."
        });

        expect(result.provider).toBe("openai:gpt-4o-transcribe");
        expect(result.rawText.toLowerCase()).toContain("tomorrow");
        expect(result.rawText.toLowerCase()).toMatch(/three|3/);
      } finally {
        await rm(path.dirname(wavPath), { recursive: true, force: true });
      }
    },
    60_000
  );

  it(
    "refines a self-correction with the real LLM provider",
    async () => {
      const env = loadRealProviderEnv();
      const llm = new OpenAICompatibleLLMProvider(env.llm);
      const prompt = buildDictationPrompt({
        rawText: "um let's meet tomorrow at seven no actually make that three",
        language: "en",
        context: {
          app_name: "TextEdit",
          bundle_id: "com.apple.TextEdit",
          window_title: "Untitled",
          writable: true,
          selection_present: false,
          nearby_text: ""
        },
        dictionary: [],
        preferences: {
          style: "balanced",
          output_language: "follow_input",
          format_lists: true
        }
      });

      const result = await llm.complete({
        messages: [
          { role: "system", content: prompt.system },
          { role: "user", content: prompt.user }
        ],
        temperature: env.llm.temperature,
        responseFormat: "json_object"
      });
      const refined = validateRefinedResult({
        rawText: "um let's meet tomorrow at seven no actually make that three",
        llmContent: result.content,
        dictionaryTerms: []
      });

      expect(result.provider).toBe(`openai-compatible:${env.llm.model}`);
      expect(refined.refinedText.toLowerCase()).toMatch(/three|3/);
      expect(refined.refinedText.toLowerCase()).not.toContain("seven");
    },
    60_000
  );
});

function loadRealProviderEnv() {
  loadDotenv();
  return loadApiEnv(process.env);
}

async function createSpokenWavFixture(text: string) {
  const directory = await mkdtemp(path.join(tmpdir(), "echo-real-provider-"));
  const aiffPath = path.join(directory, "speech.aiff");
  const wavPath = path.join(directory, "speech.wav");

  await execFileAsync("say", ["-o", aiffPath, text]);
  await execFileAsync("afconvert", ["-f", "WAVE", "-d", "LEI16@16000", aiffPath, wavPath]);

  return wavPath;
}
