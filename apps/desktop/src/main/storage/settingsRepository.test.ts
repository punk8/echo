import { describe, expect, it } from "vitest";
import { createSettingsRepository } from "./settingsRepository";
import { useTempDatabase } from "./testDb";

describe("settingsRepository", () => {
  const temp = useTempDatabase();

  it("saves and reads retention settings", () => {
    const repo = createSettingsRepository(temp.db);

    expect(repo.getSettings().historyRetention).toBe("1_week");

    repo.saveSettings({ historyRetention: "24_hours", shortcut: "Alt+Space" });

    expect(repo.getSettings()).toEqual({
      historyRetention: "24_hours",
      shortcut: "Alt+Space",
      language: "auto"
    });
  });
});
