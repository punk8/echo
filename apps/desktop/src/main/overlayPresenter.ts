import { computeBottomOverlayBounds, type Rectangle } from "./windowPlacement";

export interface OverlayWindowLike {
  getBounds: () => Rectangle;
  setBounds: (bounds: Rectangle) => void;
  showInactive: () => void;
  hide: () => void;
  webContents: {
    send: (channel: string, payload: unknown) => void;
  };
}

export interface OverlayPresenterDeps {
  overlay: OverlayWindowLike;
  getDisplayWorkArea: () => Rectangle;
}

export function createOverlayPresenter(deps: OverlayPresenterDeps) {
  let hideTimer: ReturnType<typeof setTimeout> | undefined;

  return {
    show(payload: Record<string, unknown>, autoHideMs?: number) {
      clearAutoHideTimer();
      deps.overlay.setBounds(
        computeBottomOverlayBounds({
          displayWorkArea: deps.getDisplayWorkArea(),
          overlaySize: deps.overlay.getBounds()
        })
      );
      deps.overlay.showInactive();
      deps.overlay.webContents.send("echo:overlay-state", payload);

      if (autoHideMs) {
        hideTimer = setTimeout(() => {
          hideTimer = undefined;
          deps.overlay.hide();
        }, autoHideMs);
      }
    },

    hide() {
      clearAutoHideTimer();
      deps.overlay.hide();
    }
  };

  function clearAutoHideTimer() {
    if (!hideTimer) {
      return;
    }
    clearTimeout(hideTimer);
    hideTimer = undefined;
  }
}
