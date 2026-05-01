import { describe, expect, it, vi } from "vitest";
import { OpenAICompatibleLLMProvider } from "./OpenAICompatibleLLMProvider";

describe("OpenAICompatibleLLMProvider", () => {
  it("posts chat completions to the configured base URL", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content:
                "{\"refined_text\":\"Tomorrow at three.\",\"language\":\"en\",\"edits\":[],\"risk\":\"low\",\"warnings\":[]}"
            }
          }
        ]
      })
    });
    const provider = new OpenAICompatibleLLMProvider({
      apiKey: "secret",
      baseUrl: "https://api.openai.com/v1",
      model: "gpt-4o",
      fetchImpl
    });

    const result = await provider.complete({
      messages: [
        { role: "system", content: "Return JSON" },
        { role: "user", content: "raw" }
      ],
      temperature: 0.2,
      responseFormat: "json_object"
    });

    expect(fetchImpl).toHaveBeenCalledWith(
      "https://api.openai.com/v1/chat/completions",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer secret"
        })
      })
    );
    expect(result.content).toContain("Tomorrow at three");
  });

  it("maps provider errors to server.refine_failed", async () => {
    const provider = new OpenAICompatibleLLMProvider({
      apiKey: "secret",
      baseUrl: "https://api.openai.com/v1",
      model: "gpt-4o",
      fetchImpl: vi.fn().mockResolvedValue({ ok: false, status: 500, text: async () => "bad" })
    });

    await expect(
      provider.complete({
        messages: [
          { role: "system", content: "Return JSON" },
          { role: "user", content: "raw" }
        ],
        temperature: 0.2,
        responseFormat: "json_object"
      })
    ).rejects.toThrow("server.refine_failed");
  });
});
