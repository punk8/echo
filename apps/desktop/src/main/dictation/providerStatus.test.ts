import { describe, expect, it, vi } from "vitest";
import { checkProviderStatus } from "./providerStatus";

describe("checkProviderStatus", () => {
  it("reports the local API as reachable when health succeeds", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true });

    await expect(checkProviderStatus({ apiBaseUrl: "http://127.0.0.1:43110", fetchImpl })).resolves.toEqual({
      reachable: true,
      apiBaseUrl: "http://127.0.0.1:43110"
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
