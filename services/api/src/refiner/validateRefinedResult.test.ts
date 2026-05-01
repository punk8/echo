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

  it("rejects refinements that change dictation into a command", () => {
    expect(() =>
      validateRefinedResult({
        rawText: "open safari",
        llmContent:
          "{\"refined_text\":\"Opening Safari.\",\"language\":\"en\",\"edits\":[],\"risk\":\"low\",\"warnings\":[],\"mode\":\"command\",\"action\":\"open_app\"}",
        dictionaryTerms: []
      })
    ).toThrow("server.refine_failed");
  });

  it("rejects refinements that change dictation into an answer", () => {
    expect(() =>
      validateRefinedResult({
        rawText: "what time is the meeting",
        llmContent:
          "{\"refined_text\":\"The meeting is at 3 PM.\",\"language\":\"en\",\"edits\":[],\"risk\":\"low\",\"warnings\":[],\"mode\":\"answer\",\"answer\":\"The meeting is at 3 PM.\"}",
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

  it("raises risk when numbers disappear from the refined text", () => {
    const result = validateRefinedResult({
      rawText: "send invoice 12345 tomorrow",
      llmContent:
        "{\"refined_text\":\"Send the invoice tomorrow.\",\"language\":\"en\",\"edits\":[],\"risk\":\"low\",\"warnings\":[]}",
      dictionaryTerms: []
    });

    expect(result.risk).toBe("medium");
    expect(result.warnings).toContain("critical_token_missing:12345");
  });

  it("raises risk when date words disappear from the refined text", () => {
    const result = validateRefinedResult({
      rawText: "schedule it for January 12",
      llmContent:
        "{\"refined_text\":\"Schedule it soon.\",\"language\":\"en\",\"edits\":[],\"risk\":\"low\",\"warnings\":[]}",
      dictionaryTerms: []
    });

    expect(result.risk).toBe("medium");
    expect(result.warnings).toContain("critical_token_missing:January");
    expect(result.warnings).toContain("critical_token_missing:12");
  });
});
