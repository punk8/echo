import { describe, expect, it, vi } from "vitest";
import { buildOverlayState, cancelDictationAndRefreshHistory, isOverlayRouteHash, saveSettingsAndRefreshHistory } from "./App";

describe("buildOverlayState", () => {
  it("recognizes packaged overlay window hashes", () => {
    expect(isOverlayRouteHash("#overlay")).toBe(true);
    expect(isOverlayRouteHash("#/overlay")).toBe(true);
    expect(isOverlayRouteHash("#settings")).toBe(false);
  });

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

  it("retries the retained recording when an overlay error provides a history id", () => {
    const onFinish = vi.fn();
    const onRetryHistory = vi.fn();
    const overlayState = buildOverlayState(
      { status: "error", sessionId: "session-1", code: "server.refine_failed", message: "Dictation refinement failed." },
      {
        status: "error",
        sessionId: "session-1",
        message: "Dictation refinement failed.",
        retryHistoryId: "session-1"
      },
      [],
      0,
      onFinish,
      vi.fn(),
      null,
      vi.fn(),
      vi.fn(),
      onRetryHistory
    );

    if (overlayState.status !== "error") {
      throw new Error("expected error overlay state");
    }

    overlayState.onRetry();

    expect(onRetryHistory).toHaveBeenCalledWith("session-1");
    expect(onFinish).not.toHaveBeenCalled();
  });

  it("maps accessibility permission errors to a settings recovery action", () => {
    const onResolvePermission = vi.fn();
    const overlayState = buildOverlayState(
      {
        status: "error",
        sessionId: "session-1",
        code: "permission.accessibility_missing",
        message: "Accessibility permission is required to insert dictation into other apps."
      },
      {
        status: "error",
        sessionId: "session-1",
        code: "permission.accessibility_missing",
        message: "Accessibility permission is required to insert dictation into other apps."
      },
      [],
      0,
      vi.fn(),
      vi.fn(),
      null,
      vi.fn(),
      vi.fn(),
      vi.fn(),
      onResolvePermission
    );

    if (overlayState.status !== "error") {
      throw new Error("expected error overlay state");
    }

    expect(overlayState.recoveryActionLabel).toBe("Open Accessibility Settings");
    overlayState.onRecoveryAction?.();

    expect(onResolvePermission).toHaveBeenCalledWith("permission.accessibility_missing");
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

  it("maps finalizing overlay payloads to cancellable finalizing state", () => {
    const onCancel = vi.fn();
    const overlayState = buildOverlayState(
      { status: "recording", sessionId: "session-1" },
      {
        status: "finalizing",
        sessionId: "session-1"
      },
      [0.2],
      1200,
      vi.fn(),
      onCancel,
      null
    );

    if (overlayState.status !== "finalizing") {
      throw new Error("expected finalizing overlay state");
    }

    overlayState.onCancel();

    expect(onCancel).toHaveBeenCalledOnce();
  });

  it("maps processing overlay payload stage text", () => {
    const overlayState = buildOverlayState(
      { status: "processing", sessionId: "session-1" },
      {
        status: "processing",
        sessionId: "session-1",
        stageText: "Transcribing audio and refining text"
      },
      [],
      0,
      vi.fn(),
      vi.fn(),
      null
    );

    expect(overlayState).toEqual({
      status: "processing",
      stageText: "Transcribing audio and refining text"
    });
  });
});

describe("saveSettingsAndRefreshHistory", () => {
  it("refreshes visible history after retention settings prune rows", async () => {
    const setSnapshot = vi.fn();
    const setHistory = vi.fn();
    const saveSettings = vi.fn().mockResolvedValue({ historyRetention: "never" });
    const listHistory = vi.fn().mockResolvedValue([]);

    await saveSettingsAndRefreshHistory({
      settings: { historyRetention: "never" },
      saveSettings,
      listHistory,
      setSnapshot,
      setHistory
    });

    expect(saveSettings).toHaveBeenCalledWith({ historyRetention: "never" });
    expect(listHistory).toHaveBeenCalledOnce();
    expect(setHistory).toHaveBeenCalledWith([]);
  });
});

describe("cancelDictationAndRefreshHistory", () => {
  it("refreshes visible history after cancellation writes a cancelled row", async () => {
    const cancelledSnapshot = {
      state: { status: "cancelled" as const, sessionId: "session-1" },
      settings: { historyRetention: "1_week" }
    };
    const rows = [{ id: "session-1", status: "cancelled" }];
    const setSnapshot = vi.fn();
    const setHistory = vi.fn();
    const cancelDictation = vi.fn().mockResolvedValue(cancelledSnapshot);
    const listHistory = vi.fn().mockResolvedValue(rows);

    await cancelDictationAndRefreshHistory({
      cancelDictation,
      listHistory,
      setSnapshot,
      setHistory
    });

    expect(cancelDictation).toHaveBeenCalledOnce();
    expect(setSnapshot).toHaveBeenCalledWith(cancelledSnapshot);
    expect(listHistory).toHaveBeenCalledOnce();
    expect(setHistory).toHaveBeenCalledWith(rows);
  });
});
