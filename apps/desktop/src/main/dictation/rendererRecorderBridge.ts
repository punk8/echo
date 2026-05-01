import type { WebContents } from "electron";
import type { AudioFormat } from "@echo/shared";
import type { RecordedAudio } from "./sessionController";

interface RendererRecorderBridgeDeps {
  webContents: Pick<WebContents, "send">;
  ipcMain: {
    handle: (channel: string, listener: (event: unknown, payload: any) => unknown) => void;
  };
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
    resolvePending(stops, payload.sessionId, {
      audio: Buffer.from(new Uint8Array(payload.audio)),
      audioFormat: payload.audioFormat,
      durationMs: payload.durationMs,
      localPath: payload.localPath
    });
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
