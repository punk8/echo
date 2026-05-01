import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { DictionaryPage } from "./DictionaryPage";

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
    expect(markup).toContain("EH-koh");
    expect(markup).toContain("Edit");
  });
});
