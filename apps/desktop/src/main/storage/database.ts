import DatabaseConstructor from "better-sqlite3";
import type { Database } from "better-sqlite3";

export function openEchoDatabase(dbPath: string): Database {
  const db = new DatabaseConstructor(dbPath);
  db.pragma("journal_mode = WAL");
  migrate(db);
  return db;
}

function migrate(db: Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS dictation_history (
      id TEXT PRIMARY KEY,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      status TEXT NOT NULL,
      raw_text TEXT NOT NULL,
      refined_text TEXT NOT NULL,
      audio_local_path TEXT,
      duration_ms INTEGER NOT NULL,
      language TEXT NOT NULL,
      focused_app_name TEXT NOT NULL,
      focused_app_bundle_id TEXT NOT NULL,
      focused_app_window_title TEXT NOT NULL,
      insertion_method TEXT NOT NULL,
      insertion_status TEXT NOT NULL,
      provider_asr TEXT NOT NULL,
      provider_llm TEXT NOT NULL,
      error_code TEXT,
      timing_json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS dictionary_terms (
      id TEXT PRIMARY KEY,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      term TEXT NOT NULL,
      aliases_json TEXT NOT NULL,
      case_sensitive INTEGER NOT NULL,
      source TEXT NOT NULL,
      language TEXT NOT NULL,
      pronunciation_hint TEXT,
      capitalization TEXT
    );
  `);
  addColumnIfMissing(db, "dictionary_terms", "pronunciation_hint", "TEXT");
  addColumnIfMissing(db, "dictionary_terms", "capitalization", "TEXT");
}

function addColumnIfMissing(db: Database, tableName: string, columnName: string, columnDefinition: string) {
  const columns = db.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{ name: string }>;
  if (!columns.some((column) => column.name === columnName)) {
    db.prepare(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDefinition}`).run();
  }
}
