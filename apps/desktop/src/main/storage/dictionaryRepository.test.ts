import { describe, expect, it } from "vitest";
import { createDictionaryRepository } from "./dictionaryRepository";
import { useTempDatabase } from "./testDb";

describe("dictionaryRepository", () => {
  const temp = useTempDatabase();

  it("stores manual terms and searches case-insensitively", () => {
    const repo = createDictionaryRepository(temp.db);

    repo.addDictionaryTerm({
      id: "term-1",
      term: "Echo",
      aliases: ["echo app"],
      case_sensitive: true,
      source: "manual",
      language: "en",
      pronunciation_hint: "EH-koh",
      capitalization: "Echo"
    });

    const rows = repo.searchDictionaryTerms("ech");

    expect(rows).toHaveLength(1);
    expect(rows[0]?.term).toBe("Echo");
    expect(rows[0]?.aliases).toEqual(["echo app"]);
    expect(rows[0]?.pronunciation_hint).toBe("EH-koh");
    expect(rows[0]?.capitalization).toBe("Echo");
  });

  it("updates existing terms", () => {
    const repo = createDictionaryRepository(temp.db);
    repo.addDictionaryTerm({
      id: "term-1",
      term: "Echo",
      aliases: [],
      case_sensitive: true,
      source: "manual",
      language: "en",
      pronunciation_hint: null,
      capitalization: null
    });

    repo.updateDictionaryTerm({
      id: "term-1",
      term: "Echo Dictation",
      aliases: ["echo app"],
      case_sensitive: false,
      source: "manual",
      language: "en",
      pronunciation_hint: "EH-koh dictation",
      capitalization: "Echo Dictation"
    });

    expect(repo.listDictionaryTerms()[0]).toMatchObject({
      id: "term-1",
      term: "Echo Dictation",
      aliases: ["echo app"],
      case_sensitive: false,
      pronunciation_hint: "EH-koh dictation",
      capitalization: "Echo Dictation"
    });
  });
});
