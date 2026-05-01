import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { DictionaryPage, filterDictionaryTerms } from "./DictionaryPage";

describe("DictionaryPage", () => {
  it("shows alias input and edit controls", () => {
    const markup = renderToStaticMarkup(
      <DictionaryPage
        terms={[
          {
            id: "term-1",
            created_at: "2026-05-02T00:00:00.000Z",
            updated_at: "2026-05-02T00:00:00.000Z",
            term: "Echo",
            aliases: ["echo app"],
            case_sensitive: true,
            source: "manual",
            language: "en",
            pronunciation_hint: "EH-koh",
            capitalization: "Echo"
          }
        ]}
        onAdd={vi.fn()}
        onUpdate={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    expect(markup).toContain("Aliases");
    expect(markup).toContain("Pronunciation");
    expect(markup).toContain("Capitalization");
    expect(markup).toContain("Language");
    expect(markup).toContain("EH-koh");
    expect(markup).toContain("Edit");
  });

  it("filters terms by source", () => {
    const manual = {
      id: "term-1",
      created_at: "2026-05-02T00:00:00.000Z",
      updated_at: "2026-05-02T00:00:00.000Z",
      term: "Echo",
      aliases: [],
      case_sensitive: true,
      source: "manual" as const,
      language: "en",
      pronunciation_hint: null,
      capitalization: null
    };
    const learned = {
      ...manual,
      id: "term-2",
      term: "Typeless",
      source: "learned" as const
    };

    expect(filterDictionaryTerms([manual, learned], "", "manual")).toEqual([manual]);
    expect(filterDictionaryTerms([manual, learned], "", "learned")).toEqual([learned]);
    expect(filterDictionaryTerms([manual, learned], "type", "all")).toEqual([learned]);
  });
});
