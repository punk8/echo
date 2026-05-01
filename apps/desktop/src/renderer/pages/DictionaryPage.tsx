import { useMemo, useState } from "react";
import type { DictionaryTermRow } from "../../main/storage/dictionaryRepository";

type SourceFilter = "all" | "manual" | "learned";

export function DictionaryPage({
  terms,
  defaultLanguage = "auto",
  onAdd,
  onUpdate,
  onDelete
}: {
  terms: DictionaryTermRow[];
  defaultLanguage?: string;
  onAdd: (
    term: string,
    aliases: string[],
    pronunciationHint: string | null,
    capitalization: string | null,
    language: string,
    caseSensitive: boolean
  ) => void;
  onUpdate: (term: DictionaryTermRow) => void;
  onDelete: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [term, setTerm] = useState("");
  const [aliases, setAliases] = useState("");
  const [pronunciationHint, setPronunciationHint] = useState("");
  const [capitalization, setCapitalization] = useState("");
  const [language, setLanguage] = useState(defaultLanguage);
  const [caseSensitive, setCaseSensitive] = useState(true);
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const filtered = useMemo(() => filterDictionaryTerms(terms, query, sourceFilter), [query, sourceFilter, terms]);

  return (
    <section className="page-stack">
      <header className="page-header compact-header">
        <div>
          <p className="eyebrow">Vocabulary</p>
          <h1>Dictionary</h1>
        </div>
        <form
          className="add-term"
          onSubmit={(event) => {
            event.preventDefault();
            const value = term.trim();
            if (value) {
              onAdd(
                value,
                splitAliases(aliases),
                normalizeOptionalField(pronunciationHint),
                normalizeOptionalField(capitalization),
                normalizeLanguage(language),
                caseSensitive
              );
              setTerm("");
              setAliases("");
              setPronunciationHint("");
              setCapitalization("");
              setLanguage(defaultLanguage);
              setCaseSensitive(true);
            }
          }}
        >
          <input value={term} onChange={(event) => setTerm(event.target.value)} placeholder="Term" aria-label="Term" />
          <input
            value={aliases}
            onChange={(event) => setAliases(event.target.value)}
            placeholder="Aliases"
            aria-label="Aliases"
          />
          <input
            value={pronunciationHint}
            onChange={(event) => setPronunciationHint(event.target.value)}
            placeholder="Pronunciation"
            aria-label="Pronunciation"
          />
          <input
            value={capitalization}
            onChange={(event) => setCapitalization(event.target.value)}
            placeholder="Capitalization"
            aria-label="Capitalization"
          />
          <input value={language} onChange={(event) => setLanguage(event.target.value)} placeholder="Language" aria-label="Language" />
          <label className="compact-toggle">
            <input
              type="checkbox"
              checked={caseSensitive}
              onChange={(event) => setCaseSensitive(event.target.checked)}
            />
            Case sensitive
          </label>
          <button type="submit">Add</button>
        </form>
      </header>

      <div className="dictionary-controls">
        <input className="search-input" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search" />
        <div className="filter-tabs" aria-label="Dictionary source">
          {(["all", "manual", "learned"] as const).map((source) => (
            <button
              key={source}
              type="button"
              className={sourceFilter === source ? "active" : ""}
              aria-pressed={sourceFilter === source}
              onClick={() => setSourceFilter(source)}
            >
              {formatSourceFilter(source)}
            </button>
          ))}
        </div>
      </div>

      <section className="dictionary-grid">
        {filtered.length === 0 ? <p className="empty-state">No terms.</p> : null}
        {filtered.map((item) => (
          <article key={item.id} className="term-row">
            <div>
              <strong>{item.term}</strong>
              <span>{formatTermDetail(item)}</span>
            </div>
            <span className="source-chip">{item.source}</span>
            <div className="row-actions">
              <button type="button" onClick={() => onUpdate(promptDictionaryUpdate(item))}>
                Edit
              </button>
              <button type="button" onClick={() => onDelete(item.id)}>
                Delete
              </button>
            </div>
          </article>
        ))}
      </section>
    </section>
  );
}

export function filterDictionaryTerms(terms: DictionaryTermRow[], query: string, sourceFilter: SourceFilter) {
  const normalizedQuery = query.trim().toLowerCase();
  return terms.filter((item) => {
    const matchesSource = sourceFilter === "all" || item.source === sourceFilter;
    const matchesQuery = !normalizedQuery || searchableDictionaryText(item).includes(normalizedQuery);
    return matchesSource && matchesQuery;
  });
}

function searchableDictionaryText(item: DictionaryTermRow) {
  return [item.term, ...item.aliases, item.pronunciation_hint, item.capitalization, item.language]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function splitAliases(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function formatTermDetail(item: DictionaryTermRow) {
  return [
    item.aliases.join(", "),
    item.pronunciation_hint ? `Pronunciation: ${item.pronunciation_hint}` : "",
    item.capitalization ? `Capitalization: ${item.capitalization}` : "",
    item.language,
    item.case_sensitive ? "Case sensitive" : "Case insensitive"
  ]
    .filter(Boolean)
    .join(" · ");
}

function normalizeOptionalField(value: string) {
  const trimmed = value.trim();
  return trimmed || null;
}

function normalizeLanguage(value: string) {
  return value.trim() || "auto";
}

function formatSourceFilter(source: SourceFilter) {
  switch (source) {
    case "all":
      return "All";
    case "manual":
      return "Manual";
    case "learned":
      return "Learned";
  }
}

function promptDictionaryUpdate(item: DictionaryTermRow): DictionaryTermRow {
  const nextTerm = window.prompt("Term", item.term)?.trim() || item.term;
  const nextAliases = window.prompt("Aliases", item.aliases.join(", ")) ?? item.aliases.join(", ");
  const nextPronunciation =
    window.prompt("Pronunciation", item.pronunciation_hint ?? "") ?? item.pronunciation_hint ?? "";
  const nextCapitalization =
    window.prompt("Capitalization", item.capitalization ?? "") ?? item.capitalization ?? "";
  const nextLanguage = window.prompt("Language", item.language) ?? item.language;
  const nextCaseSensitive =
    (window.prompt("Case sensitive? Enter yes or no.", item.case_sensitive ? "yes" : "no") ?? (item.case_sensitive ? "yes" : "no"))
      .trim()
      .toLowerCase() !== "no";
  return {
    ...item,
    term: nextTerm,
    aliases: splitAliases(nextAliases),
    pronunciation_hint: normalizeOptionalField(nextPronunciation),
    capitalization: normalizeOptionalField(nextCapitalization),
    language: normalizeLanguage(nextLanguage),
    case_sensitive: nextCaseSensitive
  };
}
