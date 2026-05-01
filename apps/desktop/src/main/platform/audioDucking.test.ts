import { describe, expect, it, vi } from "vitest";
import { createSystemAudioDucker } from "./audioDucking";

describe("createSystemAudioDucker", () => {
  it("captures current output state before muting system output", async () => {
    const runAppleScript = vi.fn().mockResolvedValueOnce("42,false").mockResolvedValueOnce("");
    const ducker = createSystemAudioDucker({ runAppleScript });

    await ducker.duck();

    expect(runAppleScript.mock.calls[0]?.[0]).toContain("get volume settings");
    expect(runAppleScript).toHaveBeenNthCalledWith(2, "set volume with output muted");
  });

  it("restores the captured output volume and mute state", async () => {
    const runAppleScript = vi.fn().mockResolvedValueOnce("42,false").mockResolvedValueOnce("").mockResolvedValueOnce("");
    const ducker = createSystemAudioDucker({ runAppleScript });

    await ducker.duck();
    await ducker.restore();

    expect(runAppleScript).toHaveBeenLastCalledWith("set volume output volume 42\nset volume without output muted");
  });

  it("does not overwrite the original state when duck is called repeatedly", async () => {
    const runAppleScript = vi.fn().mockResolvedValueOnce("42,false").mockResolvedValueOnce("");
    const ducker = createSystemAudioDucker({ runAppleScript });

    await ducker.duck();
    await ducker.duck();

    expect(runAppleScript).toHaveBeenCalledTimes(2);
  });

  it("does nothing when restore is called before ducking", async () => {
    const runAppleScript = vi.fn();
    const ducker = createSystemAudioDucker({ runAppleScript });

    await ducker.restore();

    expect(runAppleScript).not.toHaveBeenCalled();
  });
});
