import { describe, expect, it, vi } from "vitest";
import { chooseAudioMimeType, createAudioRecorder } from "./audioRecorder";

class FakeMediaRecorder {
  static supported = true;
  static isTypeSupported = vi.fn((mimeType: string) => FakeMediaRecorder.supported && mimeType === "audio/webm");

  ondataavailable: ((event: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;

  constructor(
    readonly stream: MediaStream,
    readonly options: MediaRecorderOptions
  ) {}

  start = vi.fn();

  stop = vi.fn(() => {
    this.ondataavailable?.({
      data: new Blob(["audio"], this.options.mimeType ? { type: this.options.mimeType } : {})
    });
    this.onstop?.();
  });
}

describe("chooseAudioMimeType", () => {
  it("chooses audio/webm when MediaRecorder supports it", () => {
    FakeMediaRecorder.supported = true;

    expect(chooseAudioMimeType(FakeMediaRecorder as unknown as typeof MediaRecorder)).toEqual({
      audioFormat: "webm",
      mimeType: "audio/webm"
    });
  });

  it("falls back to wav when webm is unavailable", () => {
    FakeMediaRecorder.supported = false;

    expect(chooseAudioMimeType(FakeMediaRecorder as unknown as typeof MediaRecorder)).toEqual({
      audioFormat: "wav",
      mimeType: "audio/wav"
    });
  });
});

describe("createAudioRecorder", () => {
  it("returns recorded blob, duration, and level samples after stop", async () => {
    FakeMediaRecorder.supported = true;
    const levels: number[] = [];
    const stream = { getTracks: () => [{ stop: vi.fn() }] } as unknown as MediaStream;
    const recorder = createAudioRecorder({
      mediaDevices: { getUserMedia: vi.fn().mockResolvedValue(stream) },
      MediaRecorder: FakeMediaRecorder as unknown as typeof MediaRecorder,
      now: vi.fn().mockReturnValueOnce(100).mockReturnValueOnce(1450),
      createLevelSampler: (_stream, onLevel) => {
        onLevel(0.42);
        return () => undefined;
      },
      onLevel: (level) => levels.push(level)
    });

    await recorder.start();
    const result = await recorder.stop();

    expect(result.audioFormat).toBe("webm");
    expect(result.durationMs).toBe(1350);
    expect(await result.blob.text()).toBe("audio");
    expect(levels).toEqual([0.42]);
  });

  it("requests a configured microphone device when one is selected", async () => {
    const getUserMedia = vi.fn().mockResolvedValue({ getTracks: () => [{ stop: vi.fn() }] } as unknown as MediaStream);
    const recorder = createAudioRecorder({
      deviceId: "built-in-mic",
      mediaDevices: { getUserMedia },
      MediaRecorder: FakeMediaRecorder as unknown as typeof MediaRecorder,
      createLevelSampler: () => () => undefined
    });

    await recorder.start();

    expect(getUserMedia).toHaveBeenCalledWith({
      audio: {
        deviceId: { exact: "built-in-mic" }
      }
    });
    recorder.cancel();
  });
});
