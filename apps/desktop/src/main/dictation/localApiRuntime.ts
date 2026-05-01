import { spawn as spawnChild } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

export interface LocalApiRuntime {
  apiBaseUrl: string;
  managed: boolean;
  startupError?: string;
  stop: () => void;
}

export interface EnsureLocalApiRuntimeInput {
  env?: NodeJS.ProcessEnv;
  cwd?: string;
  workspaceRoot?: string;
  fileExists?: (filePath: string) => boolean;
  fetchImpl?: (url: string) => Promise<{ ok: boolean }>;
  spawn?: (
    command: string,
    args: string[],
    options: { cwd: string; env: NodeJS.ProcessEnv; stdio: ["ignore", "ignore", "pipe"] }
  ) => ManagedChildProcess;
  sleep?: (ms: number) => Promise<void>;
}

interface ManagedChildProcess {
  kill: () => unknown;
  on?: (event: "error" | "exit", listener: (...args: unknown[]) => void) => unknown;
  stderr?: {
    on: (event: "data", listener: (chunk: Buffer) => void) => unknown;
  };
}

const defaultHost = "127.0.0.1";
const defaultPort = "43110";
const healthRetryCount = 12;
const healthRetryIntervalMs = 250;
const builtApiEntry = "services/api/dist/services/api/src/index.js";

export async function ensureLocalApiRuntime(input: EnsureLocalApiRuntimeInput = {}): Promise<LocalApiRuntime> {
  const env = input.env ?? process.env;
  const explicitApiBaseUrl = normalizeBlank(env.API_BASE_URL);

  if (explicitApiBaseUrl) {
    return {
      apiBaseUrl: explicitApiBaseUrl,
      managed: false,
      stop: () => undefined
    };
  }

  const host = normalizeBlank(env.API_HOST) ?? defaultHost;
  const port = normalizeBlank(env.API_PORT) ?? defaultPort;
  const apiBaseUrl = `http://${host}:${port}`;
  const fetchImpl = input.fetchImpl ?? fetch;

  if (await isApiHealthy(apiBaseUrl, fetchImpl)) {
    return {
      apiBaseUrl,
      managed: false,
      stop: () => undefined
    };
  }

  const workspaceRoot = input.workspaceRoot ?? findWorkspaceRoot(input.cwd ?? process.cwd());
  const spawn = input.spawn ?? spawnChild;
  const localApiCommand = resolveLocalApiCommand(workspaceRoot, input.fileExists ?? existsSync);
  let startupError: string | undefined;
  const child = spawn(localApiCommand.command, localApiCommand.args, {
    cwd: workspaceRoot,
    env: {
      ...process.env,
      ...env,
      API_HOST: host,
      API_PORT: port
    },
    stdio: ["ignore", "ignore", "pipe"]
  });

  child.stderr?.on("data", (chunk) => {
    startupError = startupError ?? parseStartupError(chunk.toString("utf8"));
  });
  child.on?.("error", () => undefined);
  child.on?.("exit", () => undefined);

  await waitForApiHealth(apiBaseUrl, fetchImpl, input.sleep ?? sleep);

  let stopped = false;
  return {
    apiBaseUrl,
    managed: true,
    ...(startupError ? { startupError } : {}),
    stop: () => {
      if (stopped) {
        return;
      }
      stopped = true;
      child.kill();
    }
  };
}

async function waitForApiHealth(
  apiBaseUrl: string,
  fetchImpl: (url: string) => Promise<{ ok: boolean }>,
  sleepImpl: (ms: number) => Promise<void>
) {
  for (let attempt = 0; attempt < healthRetryCount; attempt += 1) {
    if (await isApiHealthy(apiBaseUrl, fetchImpl)) {
      return;
    }
    await sleepImpl(healthRetryIntervalMs);
  }
}

async function isApiHealthy(apiBaseUrl: string, fetchImpl: (url: string) => Promise<{ ok: boolean }>) {
  try {
    const response = await fetchImpl(`${apiBaseUrl.replace(/\/+$/, "")}/health`);
    return response.ok;
  } catch {
    return false;
  }
}

function findWorkspaceRoot(start: string) {
  let current = path.resolve(start);

  while (true) {
    if (existsSync(path.join(current, "pnpm-workspace.yaml"))) {
      return current;
    }

    const parent = path.dirname(current);
    if (parent === current) {
      return path.resolve(start);
    }
    current = parent;
  }
}

function resolveLocalApiCommand(workspaceRoot: string, fileExists: (filePath: string) => boolean) {
  if (fileExists(path.join(workspaceRoot, builtApiEntry))) {
    return {
      command: "node",
      args: [builtApiEntry]
    };
  }

  return {
    command: "pnpm",
    args: ["--filter", "@echo/api", "exec", "tsx", "src/index.ts"]
  };
}

function normalizeBlank(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function parseStartupError(message: string) {
  const matches = Array.from(message.matchAll(/\bconfig\.[a-z_]+\b/g), (match) => match[0]);
  return matches.find((match) => match !== "config.invalid") ?? matches[0];
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}
