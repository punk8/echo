import type { Database } from "better-sqlite3";

export type HistoryRetention = "never" | "24_hours" | "1_week" | "1_month" | "forever";

export interface EchoSettings {
  historyRetention: HistoryRetention;
  shortcut: string;
  language: string;
}

export function getDefaultSettings(): EchoSettings {
  return {
    historyRetention: "1_week",
    shortcut: "Alt+Space",
    language: "auto"
  };
}

export function createSettingsRepository(db: Database) {
  return {
    getSettings(): EchoSettings {
      const defaults = getDefaultSettings();
      const rows = db.prepare("SELECT key, value FROM settings").all() as Array<{ key: string; value: string }>;
      const values = new Map(rows.map((row) => [row.key, row.value]));
      return {
        historyRetention: (values.get("historyRetention") as HistoryRetention | undefined) ?? defaults.historyRetention,
        shortcut: values.get("shortcut") ?? defaults.shortcut,
        language: values.get("language") ?? defaults.language
      };
    },

    saveSettings(settings: Partial<EchoSettings>) {
      const statement = db.prepare(
        "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
      );
      for (const [key, value] of Object.entries(settings)) {
        if (value !== undefined) {
          statement.run(key, value);
        }
      }
    }
  };
}
