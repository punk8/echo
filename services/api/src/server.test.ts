import { describe, expect, it } from "vitest";
import { buildServer } from "./server";

describe("buildServer health", () => {
  it("returns provider metadata without secrets", async () => {
    const app = buildServer({
      asr: {
        transcribe: async () => {
          throw new Error("not used");
        }
      },
      llm: {
        complete: async () => {
          throw new Error("not used");
        }
      },
      providerMetadata: {
        asr: "openai:gpt-4o-transcribe",
        llm: "openai-compatible:gpt-4o"
      }
    });

    const response = await app.inject({ method: "GET", url: "/health" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      ok: true,
      providers: {
        asr: "openai:gpt-4o-transcribe",
        llm: "openai-compatible:gpt-4o"
      }
    });
    expect(JSON.stringify(response.json())).not.toContain("secret");
  });
});
