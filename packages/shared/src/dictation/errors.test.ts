import { describe, expect, it } from "vitest";
import { DictationErrorCodes } from "./errors";

describe("DictationErrorCodes", () => {
  it("includes request validation errors emitted by the dictation API", () => {
    expect(DictationErrorCodes).toContain("server.invalid_duration");
    expect(DictationErrorCodes).toContain("server.invalid_request");
  });
});
