import { describe, expect, it } from "vitest";
import { formatShortcutError } from "./shortcutErrors";

describe("formatShortcutError", () => {
  it("uses shortcut conflict messages from the main process", () => {
    expect(
      formatShortcutError({
        registered: false,
        accelerator: "Alt+Space",
        code: "shortcut.conflict",
        message: "Shortcut Alt+Space is already in use."
      })
    ).toBe("Shortcut Alt+Space is already in use.");
  });

  it("falls back to a safe message for unknown shortcut errors", () => {
    expect(formatShortcutError({ code: "unknown" })).toBe("Shortcut could not be registered.");
  });
});
