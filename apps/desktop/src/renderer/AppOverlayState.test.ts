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

    expect(overlayState.recoverableText).toBe("raw transcript");
    overlayState.onCopy();

    expect(writeClipboard).toHaveBeenCalledWith("raw transcript");
  });

  it("dismisses overlay errors without cancelling an already-ended recording session", () => {
    const onFinish = vi.fn();
    const onCancel = vi.fn();
    const onDismiss = vi.fn();
    const overlayState = buildOverlayState(
      { status: "error", sessionId: "session-1", code: "server.refine_failed", message: "Dictation refinement failed." },
      {
        status: "error",
        sessionId: "session-1",
        message: "Dictation refinement failed."
      },
      [],
      0,
      onFinish,
      onCancel,
      null,
      vi.fn(),
      onDismiss
    );

    if (overlayState.status !== "error") {
      throw new Error("expected error overlay state");
    }

    overlayState.onDismiss();

    expect(onDismiss).toHaveBeenCalledOnce();
    expect(onCancel).not.toHaveBeenCalled();
  });

  it("maps copied overlay payloads to manual paste state", () => {
    const overlayState = buildOverlayState(
      { status: "complete", sessionId: "session-1" },
      {
        status: "copied",
        sessionId: "session-1"
      },
      [],
      0,
      vi.fn(),
      vi.fn(),
      null
    );

    expect(overlayState).toEqual({ status: "copied" });
  });

  it("maps finalizing overlay payloads to finalizing state", () => {
    const overlayState = buildOverlayState(
      { status: "recording", sessionId: "session-1" },
      {
        status: "finalizing",
        sessionId: "session-1"
      },
      [0.2],
      1200,
      vi.fn(),
      vi.fn(),
      null
    );

    expect(overlayState).toEqual({ status: "finalizing" });
  });
});
