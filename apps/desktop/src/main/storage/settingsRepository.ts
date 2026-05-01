import type { Database } from "better-sqlite3";
import type { DictationStyle } from "@echo/shared";

export type HistoryRetention = "never" | "24_hours" | "1_week" | "1_month" | "forever";

export interface EchoSettings {
  historyRetention: HistoryRetention;
  shortcut: string;
  language: string;
  microphoneDeviceId: string;
  interactionSounds: boolean;
  muteOtherAudioWhileDictating: boolean;
  launchAtLogin: boolean;
  showDockIcon: boolean;
  outputStyle: DictationStyle;
}

export function getDefaultSettings(): EchoSettings {
  return {
    historyRetention: "1_week",
    shortcut: "Alt+Space",
    language: "auto",
    microphoneDeviceId: "system",
    interactionSounds: true,
    muteOtherAudioWhileDictating: false,
    launchAtLogin: false,
    showDockIcon: true,
    outputStyle: "balanced"
  };
}

export function createSettingsRepository(db: Database) {
  return {
    getSettings(): EchoSettings {
      const defaults = getDefaultSettings();
      const rows = db.prepare("SELECT key, value FROM settings").all() as Array<{ key: string; value: string }>;
      const values = new Map(rows.map((row) => [row.key, row.value]));
      return {
        historyRetention: parseHistoryRetention(values.get("historyRetention"), defaults.historyRetention),
        shortcut: parseShortcut(values.get("shortcut"), defaults.shortcut),
        language: values.get("language") ?? defaults.language,
        microphoneDeviceId: values.get("microphoneDeviceId") ?? defaults.microphoneDeviceId,
        interactionSounds: parseBoolean(values.get("interactionSounds"), defaults.interactionSounds),
        muteOtherAudioWhileDictating: parseBoolean(
          values.get("muteOtherAudioWhileDictating"),
          defaults.muteOtherAudioWhileDictating
        ),
        launchAtLogin: parseBoolean(values.get("launchAtLogin"), defaults.launchAtLogin),
        showDockIcon: parseBoolean(values.get("showDockIcon"), defaults.showDockIcon),
        outputStyle: parseOutputStyle(values.get("outputStyle"), defaults.outputStyle)
      };
    },

    saveSettings(settings: Partial<EchoSettings>) {
      const statement = db.prepare(
        "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
      );
      for (const [key, value] of Object.entries(settings)) {
        if (value !== undefined) {
          statement.run(key, String(value));
        }
      }
    }
  };
}

function parseBoolean(value: string | undefined, fallback: boolean) {
  if (value === "true") {
    return true;
  }
  if (value === "false") {
    return false;
  }
  return fallback;
}

function parseShortcut(value: string | undefined, fallback: string) {
  const shortcut = value?.trim();
  return shortcut && shortcut.length > 0 ? shortcut : fallback;
}

function parseHistoryRetention(value: string | undefined, fallback: HistoryRetention): HistoryRetention {
  if (value === "never" || value === "24_hours" || value === "1_week" || value === "1_month" || value === "forever") {
    return value;
  }
  return fallback;
}

function parseOutputStyle(value: string | undefined, fallback: DictationStyle): DictationStyle {
  if (value === "literal" || value === "balanced" || value === "polished") {
    return value;
  }
  return fallback;
}
