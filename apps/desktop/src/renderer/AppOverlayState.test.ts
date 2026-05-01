import { describe, expect, it, vi } from "vitest";
import { buildOverlayState } from "./App";

describe("buildOverlayState", () => {
  it("copies recoverable text from overlay errors when available", () => {
    const writeClipboard = vi.fn();
    const overlayState = buildOverlayState(
      { status: "error", code: "server.refine_failed", message: "Dictation refinement failed." },
      {
        status: "error",
        sessionId: "session-1",
        message: "Dictation refinement failed.",
        recoverableText: "raw transcript"
      },
      [],
      0,
      vi.fn(),
      vi.fn(),
      null,
      writeClipboard
    );

    if (overlayState.status !== "error") {
      throw new Error("expected error overlay state");
    }

    overlayState.onCopy();

    expect(writeClipboard).toHaveBeenCalledWith("raw transcript");
  });
});
