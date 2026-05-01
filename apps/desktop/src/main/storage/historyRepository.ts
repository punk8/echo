import type { Database } from "better-sqlite3";
import type { HistoryRetention } from "./settingsRepository";

export interface HistoryRowInput {
  id: string;
  status: string;
  raw_text: string;
  refined_text: string;
  audio_local_path: string | null;
  duration_ms: number;
  output_length: number;
  language: string;
  focused_app_name: string;
  focused_app_bundle_id: string;
  focused_app_window_title: string;
  insertion_method: string;
  insertion_status: string;
  provider_asr: string;
  provider_llm: string;
  error_code: string | null;
  timing_json: string;
}

export interface HistoryRow extends HistoryRowInput {
  created_at: string;
  updated_at: string;
}

export function createHistoryRepository(db: Database) {
  return {
    insertHistoryRow(row: HistoryRowInput) {
      db.prepare(
        `
          INSERT INTO dictation_history (
            id, status, raw_text, refined_text, audio_local_path, duration_ms, output_length, language,
            focused_app_name, focused_app_bundle_id, focused_app_window_title,
            insertion_method, insertion_status, provider_asr, provider_llm, error_code, timing_json
          ) VALUES (
            @id, @status, @raw_text, @refined_text, @audio_local_path, @duration_ms, @output_length, @language,
            @focused_app_name, @focused_app_bundle_id, @focused_app_window_title,
            @insertion_method, @insertion_status, @provider_asr, @provider_llm, @error_code, @timing_json
          )
        `
      ).run(row);
    },

    listHistory(): HistoryRow[] {
      return db
        .prepare("SELECT * FROM dictation_history ORDER BY created_at DESC, rowid DESC")
        .all() as HistoryRow[];
    },

    updateInsertionStatus(id: string, insertionStatus: string) {
      db.prepare(
        "UPDATE dictation_history SET insertion_status = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?"
      ).run(insertionStatus, id);
    },

    deleteHistoryRow(id: string) {
      const audioPaths = listAudioPathsForDeletedRows(db, "WHERE id = ?", id);
      db.prepare("DELETE FROM dictation_history WHERE id = ?").run(id);
      return audioPaths;
    },

    clearHistory() {
      const audioPaths = listAudioPathsForDeletedRows(db, "");
      db.prepare("DELETE FROM dictation_history").run();
      return audioPaths;
    },

    pruneHistory(retention: HistoryRetention, now = new Date()) {
      const cutoff = cutoffForRetention(retention, now);
      if (cutoff === "none") {
        return [];
      }
      if (cutoff === "all") {
        const audioPaths = listAudioPathsForDeletedRows(db, "");
        db.prepare("DELETE FROM dictation_history").run();
        return audioPaths;
      }
      const audioPaths = listAudioPathsForDeletedRows(db, "WHERE created_at < ?", cutoff.toISOString());
      db.prepare("DELETE FROM dictation_history WHERE created_at < ?").run(cutoff.toISOString());
      return audioPaths;
    }
  };
}

function listAudioPathsForDeletedRows(db: Database, whereClause: string, ...params: unknown[]) {
  const rows = db
    .prepare(`SELECT audio_local_path FROM dictation_history ${whereClause} ORDER BY created_at ASC, rowid ASC`)
    .all(...params) as Array<{ audio_local_path: string | null }>;
  return rows.map((row) => row.audio_local_path).filter((path): path is string => Boolean(path));
}

function cutoffForRetention(retention: HistoryRetention, now: Date): Date | "all" | "none" {
  switch (retention) {
    case "never":
      return "all";
    case "24_hours":
      return subtractMs(now, 24 * 60 * 60 * 1000);
    case "1_week":
      return subtractMs(now, 7 * 24 * 60 * 60 * 1000);
    case "1_month":
      return subtractMs(now, 30 * 24 * 60 * 60 * 1000);
    case "forever":
      return "none";
  }
}

function subtractMs(value: Date, ms: number) {
  return new Date(value.getTime() - ms);
}
