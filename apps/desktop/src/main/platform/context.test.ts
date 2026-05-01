import { describe, expect, it } from "vitest";
import { buildFallbackContext } from "./context";

describe("buildFallbackContext", () => {
  it("uses the active app name when native context is unavailable", () => {
    const context = buildFallbackContext({ appName: "TextEdit" });

    expect(context.app_name).toBe("TextEdit");
    expect(context.writable).toBe(true);
  });

  it("marks focused text controls as writable", () => {
    const context = buildFallbackContext({ appName: "TextEdit", focusedRole: "AXTextArea" });

    expect(context.writable).toBe(true);
    expect(context.focused_role).toBe("AXTextArea");
  });

  it("marks focused non-text controls as not writable when accessibility role is available", () => {
    const context = buildFallbackContext({ appName: "Preview", focusedRole: "AXButton" });

    expect(context.writable).toBe(false);
  });

  it("tracks selected text when accessibility reports a selection", () => {
    const context = buildFallbackContext({ appName: "TextEdit", focusedRole: "AXTextArea", selectionPresent: true });

    expect(context.selection_present).toBe(true);
  });

  it("bounds nearby text captured from writable focused controls", () => {
    const nearbyText = `  ${"a".repeat(700)}  `;
    const context = buildFallbackContext({ appName: "TextEdit", focusedRole: "AXTextArea", nearbyText });

    expect(context.nearby_text).toHaveLength(500);
    expect(context.nearby_text).toBe("a".repeat(500));
  });

  it("does not include nearby text from non-writable controls", () => {
    const context = buildFallbackContext({ appName: "Preview", focusedRole: "AXButton", nearbyText: "button label" });

    expect(context.writable).toBe(false);
    expect(context.nearby_text).toBe("");
  });
});
