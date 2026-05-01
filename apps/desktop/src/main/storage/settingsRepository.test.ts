import { describe, expect, it } from "vitest";
import { createSettingsRepository } from "./settingsRepository";
import { useTempDatabase } from "./testDb";

describe("settingsRepository", () => {
  const temp = useTempDatabase();

  it("saves and reads dictation settings", () => {
    const repo = createSettingsRepository(temp.db);

    expect(repo.getSettings()).toEqual({
      historyRetention: "1_week",
      shortcut: "Alt+Space",
      language: "auto",
      microphoneDeviceId: "system",
      interactionSounds: true,
      muteOtherAudioWhileDictating: false,
      launchAtLogin: false,
      showDockIcon: true,
      outputStyle: "balanced"
    });

    repo.saveSettings({
      historyRetention: "24_hours",
      shortcut: "Alt+Space",
      language: "zh",
      microphoneDeviceId: "built-in-mic",
      interactionSounds: false,
      muteOtherAudioWhileDictating: true,
      launchAtLogin: true,
      showDockIcon: false,
      outputStyle: "polished"
    });

    expect(repo.getSettings()).toEqual({
      historyRetention: "24_hours",
      shortcut: "Alt+Space",
      language: "zh",
      microphoneDeviceId: "built-in-mic",
      interactionSounds: false,
      muteOtherAudioWhileDictating: true,
      launchAtLogin: true,
      showDockIcon: false,
      outputStyle: "polished"
    });
  });
});
