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
      fileExists: vi.fn(() => false),
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
        env: expect.objectContaining({
          API_HOST: "127.0.0.1",
          API_PORT: "43110"
        })
      })
    );

    runtime.stop();
    expect(child.kill).toHaveBeenCalled();
  });

  it("prefers the compiled API entry when build output exists", async () => {
    const child = { kill: vi.fn(), on: vi.fn() };
    const spawn = vi.fn(() => child);
    const fetchImpl = vi
      .fn()
      .mockRejectedValueOnce(new Error("ECONNREFUSED"))
      .mockResolvedValueOnce({ ok: true });

    await ensureLocalApiRuntime({
      env: { API_HOST: "127.0.0.1", API_PORT: "43110" },
      cwd: "/workspace/echo/apps/desktop",
      workspaceRoot: "/workspace/echo",
      spawn,
      fetchImpl,
      fileExists: vi.fn(() => true),
      sleep: vi.fn().mockResolvedValue(undefined)
    });

    expect(spawn).toHaveBeenCalledWith(
      "node",
      ["services/api/dist/services/api/src/index.js"],
      expect.objectContaining({
        cwd: "/workspace/echo"
      })
    );
  });

  it("prefers a packaged API resource when it exists", async () => {
    const child = { kill: vi.fn(), on: vi.fn() };
    const spawn = vi.fn(() => child);
    const fetchImpl = vi
      .fn()
      .mockRejectedValueOnce(new Error("ECONNREFUSED"))
      .mockResolvedValueOnce({ ok: true });
    const fileExists = vi.fn((filePath: string) => filePath === "/Echo.app/Contents/Resources/api/index.mjs");

    await ensureLocalApiRuntime({
      env: { API_HOST: "127.0.0.1", API_PORT: "43110" },
      cwd: "/workspace/echo/apps/desktop",
      workspaceRoot: "/workspace/echo",
      resourcePath: "/Echo.app/Contents/Resources",
      executablePath: "/Echo.app/Contents/MacOS/Echo",
      spawn,
      fetchImpl,
      fileExists,
      sleep: vi.fn().mockResolvedValue(undefined)
    });

    expect(spawn).toHaveBeenCalledWith(
      "/Echo.app/Contents/MacOS/Echo",
      ["/Echo.app/Contents/Resources/api/index.mjs"],
      expect.objectContaining({
        cwd: "/Echo.app/Contents/Resources",
        env: expect.objectContaining({
          ELECTRON_RUN_AS_NODE: "1"
        })
      })
    );
  });

  it("captures local API startup configuration errors", async () => {
    const child = {
      kill: vi.fn(),
      on: vi.fn(),
      stderr: {
        on: vi.fn((_event: "data", listener: (chunk: Buffer) => void) => {
          listener(
            Buffer.from('throw new Error(first?.message ?? "config.invalid");\nError: config.llm_missing')
          );
        })
      }
    };
    const spawn = vi.fn(() => child);
    const fetchImpl = vi.fn().mockRejectedValue(new Error("ECONNREFUSED"));

    const runtime = await ensureLocalApiRuntime({
      env: { API_HOST: "127.0.0.1", API_PORT: "43110" },
      cwd: "/workspace/echo/apps/desktop",
      workspaceRoot: "/workspace/echo",
      spawn,
      fetchImpl,
      fileExists: vi.fn(() => false),
      sleep: vi.fn().mockResolvedValue(undefined)
    });

    expect(runtime.startupError).toBe("config.llm_missing");
  });
});
