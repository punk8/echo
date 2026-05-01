import { describe, expect, it, vi } from "vitest";
import { createOverlayPresenter } from "./overlayPresenter";

function createOverlay() {
  return {
    getBounds: vi.fn(() => ({ x: 0, y: 0, width: 520, height: 112 })),
    setBounds: vi.fn(),
    showInactive: vi.fn(),
    hide: vi.fn(),
    webContents: {
      send: vi.fn()
    }
  };
}

describe("createOverlayPresenter", () => {
  it("positions and shows overlay state", () => {
    const overlay = createOverlay();
    const presenter = createOverlayPresenter({
      overlay,
      getDisplayWorkArea: () => ({ x: 0, y: 25, width: 1440, height: 875 })
    });

    presenter.show({ status: "recording", sessionId: "session-1" });

    expect(overlay.setBounds).toHaveBeenCalledWith({ x: 460, y: 760, width: 520, height: 112 });
    expect(overlay.showInactive).toHaveBeenCalledOnce();
    expect(overlay.webContents.send).toHaveBeenCalledWith("echo:overlay-state", {
      status: "recording",
      sessionId: "session-1"
    });
  });

  it("does not let a previous auto-hide timer hide a newer overlay", () => {
    vi.useFakeTimers();
    const overlay = createOverlay();
    const presenter = createOverlayPresenter({
      overlay,
      getDisplayWorkArea: () => ({ x: 0, y: 25, width: 1440, height: 875 })
    });

    presenter.show({ status: "complete", sessionId: "session-1" }, 1200);
    presenter.show({ status: "recording", sessionId: "session-2" });
    vi.advanceTimersByTime(1200);

    expect(overlay.hide).not.toHaveBeenCalled();
    vi.useRealTimers();
  });
});
