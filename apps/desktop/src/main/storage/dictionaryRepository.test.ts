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
      language: "en"
    });

    const rows = repo.searchDictionaryTerms("ech");

    expect(rows).toHaveLength(1);
    expect(rows[0]?.term).toBe("Echo");
    expect(rows[0]?.aliases).toEqual(["echo app"]);
  });

  it("updates existing terms", () => {
    const repo = createDictionaryRepository(temp.db);
    repo.addDictionaryTerm({
      id: "term-1",
      term: "Echo",
      aliases: [],
      case_sensitive: true,
      source: "manual",
      language: "en"
    });

    repo.updateDictionaryTerm({
      id: "term-1",
      term: "Echo Dictation",
      aliases: ["echo app"],
      case_sensitive: false,
      source: "manual",
      language: "en"
    });

    expect(repo.listDictionaryTerms()[0]).toMatchObject({
      id: "term-1",
      term: "Echo Dictation",
      aliases: ["echo app"],
      case_sensitive: false
    });
  });
});
