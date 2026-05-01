import type { AudioFormat } from "@echo/shared";

export interface AudioRecorderResult {
  blob: Blob;
  audioFormat: AudioFormat;
  durationMs: number;
}

export interface AudioRecorderDeps {
  mediaDevices?: Pick<MediaDevices, "getUserMedia">;
  MediaRecorder?: typeof MediaRecorder;
  now?: () => number;
  createLevelSampler?: (stream: MediaStream, onLevel: (level: number) => void) => () => void;
  onLevel?: (level: number) => void;
}

export interface AudioRecorder {
  start: () => Promise<void>;
  stop: () => Promise<AudioRecorderResult>;
  cancel: () => void;
}

export function chooseAudioMimeType(MediaRecorderCtor: typeof MediaRecorder = MediaRecorder) {
  if (MediaRecorderCtor.isTypeSupported("audio/webm")) {
    return { audioFormat: "webm" as const, mimeType: "audio/webm" };
  }
  return { audioFormat: "wav" as const, mimeType: "audio/wav" };
}

export function createAudioRecorder(deps: AudioRecorderDeps = {}): AudioRecorder {
  const mediaDevices = deps.mediaDevices ?? navigator.mediaDevices;
  const MediaRecorderCtor = deps.MediaRecorder ?? MediaRecorder;
  const now = deps.now ?? (() => performance.now());
  const onLevel = deps.onLevel ?? (() => undefined);
  const createLevelSampler = deps.createLevelSampler ?? createAnalyserLevelSampler;

  let stream: MediaStream | undefined;
  let recorder: MediaRecorder | undefined;
  let chunks: Blob[] = [];
  let startedAt = 0;
  let audioFormat: AudioFormat = "webm";
  let cleanupLevelSampler: (() => void) | undefined;

  return {
    async start() {
      stream = await mediaDevices.getUserMedia({ audio: true });
      const selected = chooseAudioMimeType(MediaRecorderCtor);
      audioFormat = selected.audioFormat;
      chunks = [];
      startedAt = now();

      recorder = new MediaRecorderCtor(stream, { mimeType: selected.mimeType });
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };
      cleanupLevelSampler = createLevelSampler(stream, onLevel);
      recorder.start();
    },

    stop() {
      const activeRecorder = recorder;
      const activeStream = stream;
      if (!activeRecorder || !activeStream) {
        return Promise.reject(new Error("audio.recorder_not_started"));
      }

      return new Promise<AudioRecorderResult>((resolve) => {
        activeRecorder.onstop = () => {
          cleanupLevelSampler?.();
          stopStream(activeStream);
          const durationMs = Math.max(0, Math.round(now() - startedAt));
          const mimeType = audioFormat === "webm" ? "audio/webm" : "audio/wav";
          const blob = new Blob(chunks, { type: mimeType });
          recorder = undefined;
          stream = undefined;
          resolve({ blob, audioFormat, durationMs });
        };
        activeRecorder.stop();
      });
    },

    cancel() {
      cleanupLevelSampler?.();
      if (recorder && recorder.state !== "inactive") {
        recorder.stop();
      }
      if (stream) {
        stopStream(stream);
      }
      recorder = undefined;
      stream = undefined;
      chunks = [];
    }
  };
}

function createAnalyserLevelSampler(stream: MediaStream, onLevel: (level: number) => void) {
  const AudioContextCtor = window.AudioContext ?? window.webkitAudioContext;
  if (!AudioContextCtor) {
    return () => undefined;
  }

  const audioContext = new AudioContextCtor();
  const source = audioContext.createMediaStreamSource(stream);
  const analyser = audioContext.createAnalyser();
  analyser.fftSize = 256;
  source.connect(analyser);

  const data = new Uint8Array(analyser.fftSize);
  let frame = 0;
  const tick = () => {
    analyser.getByteTimeDomainData(data);
    let sum = 0;
    for (const value of data) {
      const normalized = (value - 128) / 128;
      sum += normalized * normalized;
    }
    onLevel(Math.min(1, Math.sqrt(sum / data.length) * 2));
    frame = window.requestAnimationFrame(tick);
  };
  frame = window.requestAnimationFrame(tick);

  return () => {
    window.cancelAnimationFrame(frame);
    source.disconnect();
    void audioContext.close();
  };
}

function stopStream(stream: MediaStream) {
  for (const track of stream.getTracks()) {
    track.stop();
  }
}

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }
}
