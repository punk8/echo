import { describe, expect, it, vi } from "vitest";
import { copyTextToClipboard, pasteTextWithClipboardFallback } from "./insertion";

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

describe("copyTextToClipboard", () => {
  it("copies text without invoking paste", async () => {
    const clipboard = { readText: vi.fn(() => "before"), writeText: vi.fn() };

    const result = await copyTextToClipboard("hello", { clipboard });

    expect(clipboard.writeText).toHaveBeenCalledWith("hello");
    expect(result).toEqual({ method: "clipboard", status: "copied" });
  });
});
