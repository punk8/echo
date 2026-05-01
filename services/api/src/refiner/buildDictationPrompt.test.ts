import { describe, expect, it } from "vitest";
import { buildDictationPrompt } from "./buildDictationPrompt";

describe("buildDictationPrompt", () => {
  it("requires cleanup, self-correction handling, formatting, and no command execution", () => {
    const prompt = buildDictationPrompt({
      rawText: "um tomorrow at seven no make it three",
      language: "auto",
      context: {
        app_name: "TextEdit",
        bundle_id: "com.apple.TextEdit",
        window_title: "Untitled",
        writable: true,
        selection_present: false,
        nearby_text: ""
      },
      dictionary: [{ term: "Echo", aliases: [], case_sensitive: true, source: "manual" }],
      preferences: { style: "balanced", output_language: "follow_input", format_lists: true }
    });

    expect(prompt.system).toContain("Remove filler words");
    expect(prompt.system).toContain("Resolve self-corrections");
    expect(prompt.system).toContain("Do not execute commands");
    expect(prompt.user).toContain("Echo");
    expect(prompt.user).toContain("um tomorrow at seven no make it three");
  });
});
