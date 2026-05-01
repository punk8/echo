import { describe, expect, it, vi } from "vitest";
import { pasteTextWithClipboardFallback } from "./insertion";

describe("pasteTextWithClipboardFallback", () => {
  it("writes text to clipboard and invokes paste", async () => {
    const clipboard = { readText: vi.fn(() => "before"), writeText: vi.fn() };
    const runPaste = vi.fn().mockResolvedValue(undefined);

    const result = await pasteTextWithClipboardFallback("hello", { clipboard, runPaste });

    expect(clipboard.writeText).toHaveBeenCalledWith("hello");
    expect(runPaste).toHaveBeenCalled();
    expect(result).toEqual({ method: "clipboard_paste", status: "inserted" });
  });
});
