import { describe, expect, it } from "vitest";
import { computeBottomOverlayBounds } from "./windowPlacement";

describe("computeBottomOverlayBounds", () => {
  it("centers the overlay near the bottom of the active display work area", () => {
    expect(
      computeBottomOverlayBounds({
        displayWorkArea: { x: 0, y: 25, width: 1440, height: 875 },
        overlaySize: { width: 520, height: 112 }
      })
    ).toEqual({ x: 460, y: 760, width: 520, height: 112 });
  });

  it("clamps the overlay inside a narrow display work area", () => {
    expect(
      computeBottomOverlayBounds({
        displayWorkArea: { x: 100, y: 50, width: 420, height: 500 },
        overlaySize: { width: 520, height: 112 }
      })
    ).toEqual({ x: 100, y: 410, width: 420, height: 112 });
  });
});
