import { useMemo, useState } from "react";
import type { DictionaryTermRow } from "../../main/storage/dictionaryRepository";

export function DictionaryPage({
  terms,
  onAdd,
  onDelete
}: {
  terms: DictionaryTermRow[];
  onAdd: (term: string) => void;
  onDelete: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [term, setTerm] = useState("");
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
              onAdd(value);
              setTerm("");
            }
          }}
        >
          <input value={term} onChange={(event) => setTerm(event.target.value)} placeholder="Term" aria-label="Term" />
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
              <span>{item.aliases.join(", ") || item.language}</span>
            </div>
            <span className="source-chip">{item.source}</span>
            <button type="button" onClick={() => onDelete(item.id)}>
              Delete
            </button>
          </article>
        ))}
      </section>
    </section>
  );
}
