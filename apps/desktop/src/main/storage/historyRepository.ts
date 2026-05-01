import type { Database } from "better-sqlite3";

export interface HistoryRowInput {
  id: string;
  status: string;
  raw_text: string;
  refined_text: string;
  audio_local_path: string | null;
  duration_ms: number;
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
            id, status, raw_text, refined_text, audio_local_path, duration_ms, language,
            focused_app_name, focused_app_bundle_id, focused_app_window_title,
            insertion_method, insertion_status, provider_asr, provider_llm, error_code, timing_json
          ) VALUES (
            @id, @status, @raw_text, @refined_text, @audio_local_path, @duration_ms, @language,
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
      db.prepare("DELETE FROM dictation_history WHERE id = ?").run(id);
    }
  };
}
