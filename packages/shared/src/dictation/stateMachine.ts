import type { DictationErrorCode } from "./errors";

export type DictationState =
  | { status: "idle" }
  | { status: "preparing" }
  | { status: "recording"; sessionId: string }
  | { status: "finalizing"; sessionId: string }
  | { status: "processing"; sessionId: string }
  | { status: "inserting"; sessionId: string }
  | { status: "complete"; sessionId: string }
  | { status: "cancelled"; sessionId: string }
  | { status: "error"; sessionId?: string; code: DictationErrorCode | string; message: string };

export type DictationEvent =
  | { type: "prepare" }
  | { type: "recording_started"; sessionId: string }
  | { type: "stop_requested" }
  | { type: "processing_started" }
  | { type: "insert_started" }
  | { type: "completed" }
  | { type: "cancel" }
  | { type: "fail"; code: DictationErrorCode | string; message: string };

export function applyDictationEvent(state: DictationState, event: DictationEvent): DictationState {
  if (event.type === "fail") {
    const errorState: DictationState = {
      status: "error",
      code: event.code,
      message: event.message
    };
    if ("sessionId" in state) {
      return { ...errorState, sessionId: state.sessionId };
    }
    return errorState;
  }

  switch (event.type) {
    case "prepare":
      if (state.status !== "idle") {
        throw new Error(`Cannot prepare from ${state.status}`);
      }
      return { status: "preparing" };

    case "recording_started":
      if (state.status !== "preparing") {
        throw new Error(`Cannot start recording from ${state.status}`);
      }
      return { status: "recording", sessionId: event.sessionId };

    case "stop_requested":
      if (state.status !== "recording") {
        throw new Error(`Cannot stop from ${state.status}`);
      }
      return { status: "finalizing", sessionId: state.sessionId };

    case "processing_started":
      if (state.status !== "finalizing") {
        throw new Error(`Cannot process from ${state.status}`);
      }
      return { status: "processing", sessionId: state.sessionId };

    case "insert_started":
      if (state.status !== "processing") {
        throw new Error(`Cannot insert from ${state.status}`);
      }
      return { status: "inserting", sessionId: state.sessionId };

    case "completed":
      if (state.status !== "inserting") {
        throw new Error(`Cannot complete from ${state.status}`);
      }
      return { status: "complete", sessionId: state.sessionId };

    case "cancel":
      if (state.status === "recording" || state.status === "finalizing") {
        return { status: "cancelled", sessionId: state.sessionId };
      }
      throw new Error(`Cannot cancel from ${state.status}`);
  }
}
