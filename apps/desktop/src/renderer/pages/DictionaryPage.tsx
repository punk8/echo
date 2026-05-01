import { useMemo, useState } from "react";
import type { DictionaryTermRow } from "../../main/storage/dictionaryRepository";

export function DictionaryPage({
  terms,
  onAdd,
  onUpdate,
  onDelete
}: {
  terms: DictionaryTermRow[];
  onAdd: (term: string, aliases: string[], pronunciationHint: string | null, capitalization: string | null) => void;
  onUpdate: (term: DictionaryTermRow) => void;
  onDelete: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [term, setTerm] = useState("");
  const [aliases, setAliases] = useState("");
  const [pronunciationHint, setPronunciationHint] = useState("");
  const [capitalization, setCapitalization] = useState("");
  const filtered = useMemo(
    () => terms.filter((item) => item.term.toLowerCase().includes(query.toLowerCase())),
    [query, terms]
  );

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
              onAdd(value, splitAliases(aliases), normalizeOptionalField(pronunciationHint), normalizeOptionalField(capitalization));
              setTerm("");
              setAliases("");
              setPronunciationHint("");
              setCapitalization("");
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
          <button type="submit">Add</button>
        </form>
      </header>

      <input className="search-input" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search" />

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
    item.language
  ]
    .filter(Boolean)
    .join(" · ");
}

function normalizeOptionalField(value: string) {
  const trimmed = value.trim();
  return trimmed || null;
}

function promptDictionaryUpdate(item: DictionaryTermRow): DictionaryTermRow {
  const nextTerm = window.prompt("Term", item.term)?.trim() || item.term;
  const nextAliases = window.prompt("Aliases", item.aliases.join(", ")) ?? item.aliases.join(", ");
  const nextPronunciation =
    window.prompt("Pronunciation", item.pronunciation_hint ?? "") ?? item.pronunciation_hint ?? "";
  const nextCapitalization =
    window.prompt("Capitalization", item.capitalization ?? "") ?? item.capitalization ?? "";
  return {
    ...item,
    term: nextTerm,
    aliases: splitAliases(nextAliases),
    pronunciation_hint: normalizeOptionalField(nextPronunciation),
    capitalization: normalizeOptionalField(nextCapitalization)
  };
}
