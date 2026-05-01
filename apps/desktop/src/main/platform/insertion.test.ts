import { describe, expect, it, vi } from "vitest";
import { copyTextToClipboard, insertTextWithAccessibilityFallback, pasteTextWithClipboardFallback } from "./insertion";

describe("insertTextWithAccessibilityFallback", () => {
  it("uses direct Accessibility insertion before clipboard transport", async () => {
    const directInsert = vi.fn().mockResolvedValue(undefined);
    const clipboard = { readText: vi.fn(() => "before"), writeText: vi.fn() };
    const runPaste = vi.fn();

    const result = await insertTextWithAccessibilityFallback("hello", { clipboard, directInsert, runPaste });

    expect(directInsert).toHaveBeenCalledWith("hello");
    expect(clipboard.writeText).not.toHaveBeenCalled();
    expect(runPaste).not.toHaveBeenCalled();
    expect(result).toEqual({ method: "accessibility", status: "inserted" });
  });

  it("falls back to clipboard paste when direct Accessibility insertion fails", async () => {
    const directInsert = vi.fn().mockRejectedValue(new Error("ax failed"));
    const clipboard = { readText: vi.fn(() => "before"), writeText: vi.fn() };
    const runPaste = vi.fn().mockResolvedValue(undefined);
    const sleep = vi.fn().mockResolvedValue(undefined);

    const result = await insertTextWithAccessibilityFallback("hello", { clipboard, directInsert, runPaste, sleep });

    expect(directInsert).toHaveBeenCalledWith("hello");
    expect(clipboard.writeText).toHaveBeenNthCalledWith(1, "hello");
    expect(clipboard.writeText).toHaveBeenNthCalledWith(2, "before");
    expect(result).toEqual({ method: "clipboard_paste", status: "inserted" });
  });
});

describe("pasteTextWithClipboardFallback", () => {
  it("restores the previous clipboard text after a successful paste", async () => {
    const clipboard = { readText: vi.fn(() => "before"), writeText: vi.fn() };
    const runPaste = vi.fn().mockResolvedValue(undefined);
    const sleep = vi.fn().mockResolvedValue(undefined);

    const result = await pasteTextWithClipboardFallback("hello", { clipboard, runPaste, sleep });

    expect(clipboard.writeText).toHaveBeenNthCalledWith(1, "hello");
    expect(runPaste).toHaveBeenCalled();
    expect(sleep).toHaveBeenCalled();
    expect(clipboard.writeText).toHaveBeenNthCalledWith(2, "before");
    expect(result).toEqual({ method: "clipboard_paste", status: "inserted" });
  });

  it("leaves generated text on the clipboard when paste fails", async () => {
    const clipboard = { readText: vi.fn(() => "before"), writeText: vi.fn() };
    const runPaste = vi.fn().mockRejectedValue(new Error("paste failed"));

    const result = await pasteTextWithClipboardFallback("hello", { clipboard, runPaste });

    expect(clipboard.writeText).toHaveBeenCalledTimes(1);
    expect(clipboard.writeText).toHaveBeenCalledWith("hello");
    expect(result).toEqual({ method: "clipboard", status: "copied" });
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
