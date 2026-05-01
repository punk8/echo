import type { Database } from "better-sqlite3";

export interface DictionaryTermInput {
  id: string;
  term: string;
  aliases: string[];
  case_sensitive: boolean;
  source: "manual" | "learned";
  language: string;
}

export interface DictionaryTermRow extends DictionaryTermInput {
  created_at: string;
  updated_at: string;
}

interface DictionaryTermRecord {
  id: string;
  created_at: string;
  updated_at: string;
  term: string;
  aliases_json: string;
  case_sensitive: 0 | 1;
  source: "manual" | "learned";
  language: string;
}

export function createDictionaryRepository(db: Database) {
  return {
    addDictionaryTerm(term: DictionaryTermInput) {
      db.prepare(
        `
          INSERT INTO dictionary_terms (id, term, aliases_json, case_sensitive, source, language)
          VALUES (@id, @term, @aliases_json, @case_sensitive, @source, @language)
        `
      ).run({
        ...term,
        aliases_json: JSON.stringify(term.aliases),
        case_sensitive: term.case_sensitive ? 1 : 0
      });
    },

    listDictionaryTerms(): DictionaryTermRow[] {
      const rows = db.prepare("SELECT * FROM dictionary_terms ORDER BY term COLLATE NOCASE ASC").all() as DictionaryTermRecord[];
      return rows.map(mapRecord);
    },

    searchDictionaryTerms(query: string): DictionaryTermRow[] {
      const rows = db
        .prepare("SELECT * FROM dictionary_terms WHERE lower(term) LIKE lower(?) ORDER BY term COLLATE NOCASE ASC")
        .all(`%${query}%`) as DictionaryTermRecord[];
      return rows.map(mapRecord);
    },

    deleteDictionaryTerm(id: string) {
      db.prepare("DELETE FROM dictionary_terms WHERE id = ?").run(id);
    }
  };
}

function mapRecord(record: DictionaryTermRecord): DictionaryTermRow {
  return {
    id: record.id,
    created_at: record.created_at,
    updated_at: record.updated_at,
    term: record.term,
    aliases: JSON.parse(record.aliases_json) as string[],
    case_sensitive: record.case_sensitive === 1,
    source: record.source,
    language: record.language
  };
}
