import { describe, expect, it } from "vitest";
import { validateRefinedResult } from "./validateRefinedResult";

describe("validateRefinedResult", () => {
  it("accepts a safe refinement", () => {
    const result = validateRefinedResult({
      rawText: "um tomorrow at seven no make it three",
      llmContent:
        "{\"refined_text\":\"Tomorrow at three.\",\"language\":\"en\",\"edits\":[\"resolved correction\"],\"risk\":\"low\",\"warnings\":[]}",
      dictionaryTerms: []
    });

    expect(result.refinedText).toBe("Tomorrow at three.");
    expect(result.risk).toBe("low");
  });

  it("rejects empty refined text when raw text exists", () => {
    expect(() =>
      validateRefinedResult({
        rawText: "hello",
        llmContent: "{\"refined_text\":\"\",\"language\":\"en\",\"edits\":[],\"risk\":\"low\",\"warnings\":[]}",
        dictionaryTerms: []
      })
    ).toThrow("server.refine_failed");
  });

  it("raises risk when dictionary terms disappear", () => {
    const result = validateRefinedResult({
      rawText: "Echo should remember this",
      llmContent:
        "{\"refined_text\":\"It should remember this.\",\"language\":\"en\",\"edits\":[],\"risk\":\"low\",\"warnings\":[]}",
      dictionaryTerms: ["Echo"]
    });

    expect(result.risk).toBe("medium");
    expect(result.warnings).toContain("dictionary_term_missing:Echo");
  });
});
