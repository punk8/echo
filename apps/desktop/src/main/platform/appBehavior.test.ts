import { describe, expect, it, vi } from "vitest";
import { applyAppBehaviorSettings } from "./appBehavior";

const settings = {
  historyRetention: "1_week" as const,
  shortcut: "Alt+Space",
  language: "auto",
  microphoneDeviceId: "system",
  interactionSounds: true,
  muteOtherAudioWhileDictating: false,
  launchAtLogin: true,
  showDockIcon: false,
  outputStyle: "balanced" as const
};

describe("applyAppBehaviorSettings", () => {
  it("applies login item and Dock visibility settings", () => {
    const setLoginItemSettings = vi.fn();
    const getLoginItemSettings = vi.fn(() => ({ openAtLogin: false }));
    const dock = {
      show: vi.fn(),
      hide: vi.fn()
    };

    applyAppBehaviorSettings(settings, { getLoginItemSettings, setLoginItemSettings, dock });

    expect(setLoginItemSettings).toHaveBeenCalledWith({ openAtLogin: true });
    expect(dock.hide).toHaveBeenCalled();
    expect(dock.show).not.toHaveBeenCalled();
  });

  it("skips login item writes when the current state already matches", () => {
    const setLoginItemSettings = vi.fn();

    applyAppBehaviorSettings(
      { ...settings, launchAtLogin: false },
      {
        getLoginItemSettings: () => ({ openAtLogin: false }),
        setLoginItemSettings
      }
    );

    expect(setLoginItemSettings).not.toHaveBeenCalled();
  });
});
