import { describe, expect, it, vi } from "vitest";
import { ensureLocalApiRuntime } from "./localApiRuntime";

describe("ensureLocalApiRuntime", () => {
  it("uses explicit API_BASE_URL without managing a local process", async () => {
    const spawn = vi.fn();
    const fetchImpl = vi.fn();

    const runtime = await ensureLocalApiRuntime({
      env: { API_BASE_URL: "https://echo.example.test" },
      cwd: "/workspace/echo/apps/desktop",
      spawn,
      fetchImpl
    });

    expect(runtime).toMatchObject({
      apiBaseUrl: "https://echo.example.test",
      managed: false
    });
    expect(spawn).not.toHaveBeenCalled();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("reuses an already-running local API", async () => {
    const spawn = vi.fn();
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true });

    const runtime = await ensureLocalApiRuntime({
      env: { API_HOST: "127.0.0.1", API_PORT: "43110" },
      cwd: "/workspace/echo/apps/desktop",
      spawn,
      fetchImpl
    });

    expect(runtime).toMatchObject({
      apiBaseUrl: "http://127.0.0.1:43110",
      managed: false
    });
    expect(fetchImpl).toHaveBeenCalledWith("http://127.0.0.1:43110/health");
    expect(spawn).not.toHaveBeenCalled();
  });

  it("starts the local API when the default endpoint is not reachable", async () => {
    const child = { kill: vi.fn(), on: vi.fn() };
    const spawn = vi.fn(() => child);
    const fetchImpl = vi
      .fn()
      .mockRejectedValueOnce(new Error("ECONNREFUSED"))
      .mockResolvedValueOnce({ ok: true });

    const runtime = await ensureLocalApiRuntime({
      env: { API_HOST: "127.0.0.1", API_PORT: "43110" },
      cwd: "/workspace/echo/apps/desktop",
      workspaceRoot: "/workspace/echo",
      spawn,
      fetchImpl,
      sleep: vi.fn().mockResolvedValue(undefined)
    });

    expect(runtime).toMatchObject({
      apiBaseUrl: "http://127.0.0.1:43110",
      managed: true
    });
    expect(spawn).toHaveBeenCalledWith(
      "pnpm",
      ["--filter", "@echo/api", "exec", "tsx", "src/index.ts"],
      expect.objectContaining({
        cwd: "/workspace/echo",
        stdio: "ignore",
        env: expect.objectContaining({
          API_HOST: "127.0.0.1",
          API_PORT: "43110"
        })
      })
    );

    runtime.stop();
    expect(child.kill).toHaveBeenCalled();
  });
});
