import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { WebContents } from "electron";
import type { AudioFormat } from "@echo/shared";
import type { RecordedAudio } from "./sessionController";

interface RendererRecorderBridgeDeps {
  webContents: Pick<WebContents, "send">;
  ipcMain: {
    handle: (channel: string, listener: (event: unknown, payload: any) => unknown) => void;
  };
  recordingsDir?: string;
  writeRecording?: (filename: string, audio: Buffer) => Promise<string>;
  timeoutMs?: number;
}

interface RecorderPayload {
  sessionId: string;
}

interface RecorderStoppedPayload extends RecorderPayload {
  audio: ArrayBuffer;
  audioFormat: AudioFormat;
  durationMs: number;
  localPath: string | null;
}

interface RecorderFailedPayload extends RecorderPayload {
  message: string;
}

export function createRendererRecorderBridge(deps: RendererRecorderBridgeDeps) {
  const timeoutMs = deps.timeoutMs ?? 30_000;
  const starts = new Map<string, Pending<void>>();
  const stops = new Map<string, Pending<RecordedAudio>>();

  deps.ipcMain.handle("echo:recorder-started", (_event, payload: RecorderPayload) => {
    resolvePending(starts, payload.sessionId, undefined);
  });
  deps.ipcMain.handle("echo:recorder-stopped", (_event, payload: RecorderStoppedPayload) => {
    const audio = Buffer.from(new Uint8Array(payload.audio));
    void resolveStoppedRecording(deps, payload, audio)
      .then((recording) => resolvePending(stops, payload.sessionId, recording))
      .catch((error: unknown) =>
        rejectPending(stops, payload.sessionId, error instanceof Error ? error : new Error("audio.recording_save_failed"))
      );
  });
  deps.ipcMain.handle("echo:recorder-failed", (_event, payload: RecorderFailedPayload) => {
    rejectPending(starts, payload.sessionId, new Error(payload.message));
    rejectPending(stops, payload.sessionId, new Error(payload.message));
  });

  return {
    start(sessionId: string) {
      const pending = createPending<void>(starts, sessionId, timeoutMs);
      deps.webContents.send("echo:recorder-start", { sessionId });
      return pending.promise;
    },

    stop(sessionId: string) {
      const pending = createPending<RecordedAudio>(stops, sessionId, timeoutMs);
      deps.webContents.send("echo:recorder-stop", { sessionId });
      return pending.promise;
    },

    async cancel(sessionId: string) {
      deps.webContents.send("echo:recorder-cancel", { sessionId });
      rejectPending(starts, sessionId, new Error("audio.recording_cancelled"));
      rejectPending(stops, sessionId, new Error("audio.recording_cancelled"));
    }
  };
}

async function resolveStoppedRecording(
  deps: RendererRecorderBridgeDeps,
  payload: RecorderStoppedPayload,
  audio: Buffer
): Promise<RecordedAudio> {
  return {
    audio,
    audioFormat: payload.audioFormat,
    durationMs: payload.durationMs,
    localPath: await resolveLocalPath(deps, payload, audio)
  };
}

async function resolveLocalPath(deps: RendererRecorderBridgeDeps, payload: RecorderStoppedPayload, audio: Buffer) {
  if (payload.localPath) {
    return payload.localPath;
  }
  if (!deps.recordingsDir) {
    return null;
  }

  const filename = path.join(deps.recordingsDir, `${payload.sessionId}.${payload.audioFormat}`);
  if (deps.writeRecording) {
    return deps.writeRecording(filename, audio);
  }

  await mkdir(deps.recordingsDir, { recursive: true });
  await writeFile(filename, audio);
  return filename;
}

interface Pending<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (error: Error) => void;
  timeout: NodeJS.Timeout;
}

function createPending<T>(map: Map<string, Pending<T>>, sessionId: string, timeoutMs: number) {
  const existing = map.get(sessionId);
  if (existing) {
    return existing;
  }

  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  const pending: Pending<T> = {
    promise,
    resolve,
    reject,
    timeout: setTimeout(() => {
      rejectPending(map, sessionId, new Error("audio.recorder_timeout"));
    }, timeoutMs)
  };
  map.set(sessionId, pending);
  return pending;
}

function resolvePending<T>(map: Map<string, Pending<T>>, sessionId: string, value: T) {
  const pending = map.get(sessionId);
  if (!pending) {
    return;
  }
  clearTimeout(pending.timeout);
  map.delete(sessionId);
  pending.resolve(value);
}

function rejectPending<T>(map: Map<string, Pending<T>>, sessionId: string, error: Error) {
  const pending = map.get(sessionId);
  if (!pending) {
    return;
  }
  clearTimeout(pending.timeout);
  map.delete(sessionId);
  pending.reject(error);
}
