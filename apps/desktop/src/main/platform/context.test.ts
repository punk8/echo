import { describe, expect, it } from "vitest";
import { buildFallbackContext } from "./context";

describe("buildFallbackContext", () => {
  it("uses the active app name when native context is unavailable", () => {
    const context = buildFallbackContext({ appName: "TextEdit" });

    expect(context.app_name).toBe("TextEdit");
    expect(context.writable).toBe(true);
  });
});
