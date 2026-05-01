import { describe, expect, it, vi } from "vitest";
import { checkProviderStatus } from "./providerStatus";

describe("checkProviderStatus", () => {
  it("reports the local API as reachable when health succeeds", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        providers: {
          asr: "openai:gpt-4o-transcribe",
          llm: "openai-compatible:gpt-4o"
        }
      })
    });

    await expect(checkProviderStatus({ apiBaseUrl: "http://127.0.0.1:43110", fetchImpl })).resolves.toEqual({
      reachable: true,
      apiBaseUrl: "http://127.0.0.1:43110",
      asr: "openai:gpt-4o-transcribe",
      llm: "openai-compatible:gpt-4o"
    });
  });

  it("reports the local API as unreachable without exposing secrets", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error("ECONNREFUSED"));

    await expect(checkProviderStatus({ apiBaseUrl: "http://127.0.0.1:43110", fetchImpl })).resolves.toEqual({
      reachable: false,
      apiBaseUrl: "http://127.0.0.1:43110"
    });
  });
});
