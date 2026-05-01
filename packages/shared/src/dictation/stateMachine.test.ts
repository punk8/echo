import { describe, expect, it } from "vitest";
import { applyDictationEvent } from "./stateMachine";

describe("dictation state machine", () => {
  it("moves through the normal dictation lifecycle", () => {
    let state = applyDictationEvent({ status: "idle" }, { type: "prepare" });
    state = applyDictationEvent(state, { type: "recording_started", sessionId: "s1" });
    state = applyDictationEvent(state, { type: "stop_requested" });
    state = applyDictationEvent(state, { type: "processing_started" });
    state = applyDictationEvent(state, { type: "insert_started" });
    state = applyDictationEvent(state, { type: "completed" });

    expect(state.status).toBe("complete");
  });

  it("allows cancellation only while recording or finalizing", () => {
    expect(applyDictationEvent({ status: "recording", sessionId: "s1" }, { type: "cancel" }).status).toBe("cancelled");
    expect(() => applyDictationEvent({ status: "processing", sessionId: "s1" }, { type: "cancel" })).toThrow(
      "Cannot cancel from processing"
    );
  });

  it("keeps error code and message in error state", () => {
    const state = applyDictationEvent(
      { status: "processing", sessionId: "s1" },
      { type: "fail", code: "server.asr_failed", message: "Speech recognition failed." }
    );

    expect(state).toEqual({
      status: "error",
      sessionId: "s1",
      code: "server.asr_failed",
      message: "Speech recognition failed."
    });
  });
});
