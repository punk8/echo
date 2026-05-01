import { describe, expect, it, vi } from "vitest";
import { listMicrophoneDevices } from "./audioDevices";

describe("listMicrophoneDevices", () => {
  it("lists audio input devices after the system default option", async () => {
    const enumerateDevices = vi.fn().mockResolvedValue([
      { kind: "audioinput", deviceId: "built-in", label: "MacBook Microphone" },
      { kind: "videoinput", deviceId: "camera", label: "Camera" },
      { kind: "audioinput", deviceId: "usb", label: "USB Mic" }
    ]);

    await expect(listMicrophoneDevices({ enumerateDevices })).resolves.toEqual([
      { id: "system", label: "System default" },
      { id: "built-in", label: "MacBook Microphone" },
      { id: "usb", label: "USB Mic" }
    ]);
  });

  it("falls back to the system default when devices cannot be enumerated", async () => {
    const enumerateDevices = vi.fn().mockRejectedValue(new Error("permission denied"));

    await expect(listMicrophoneDevices({ enumerateDevices })).resolves.toEqual([
      { id: "system", label: "System default" }
    ]);
  });
});
