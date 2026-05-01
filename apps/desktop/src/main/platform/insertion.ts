import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export interface ClipboardLike {
  readText: () => string;
  writeText: (text: string) => void;
}

export interface InsertionDeps {
  clipboard?: ClipboardLike;
  directInsert?: (text: string) => Promise<void>;
  runPaste?: () => Promise<void>;
  sleep?: (ms: number) => Promise<void>;
  restoreDelayMs?: number;
}

export interface InsertionResult {
  method: "accessibility" | "clipboard_paste" | "clipboard";
  status: "inserted" | "copied";
}

export async function insertTextWithAccessibilityFallback(
  text: string,
  deps: InsertionDeps = {}
): Promise<InsertionResult> {
  const directInsert = deps.directInsert ?? runMacAccessibilityInsertCommand;

  try {
    await directInsert(text);
    return { method: "accessibility", status: "inserted" };
  } catch {
    return pasteTextWithClipboardFallback(text, deps);
  }
}

export async function pasteTextWithClipboardFallback(text: string, deps: InsertionDeps = {}): Promise<InsertionResult> {
  const clipboard = deps.clipboard ?? (await import("electron")).clipboard;
  const runPaste = deps.runPaste ?? runMacPasteCommand;
  const sleep = deps.sleep ?? delay;
  const restoreDelayMs = deps.restoreDelayMs ?? 250;

  const previousText = clipboard.readText();
  clipboard.writeText(text);

  try {
    await runPaste();
    await sleep(restoreDelayMs);
    clipboard.writeText(previousText);
    return { method: "clipboard_paste", status: "inserted" };
  } catch {
    return { method: "clipboard", status: "copied" };
  }
}

export async function copyTextToClipboard(text: string, deps: Pick<InsertionDeps, "clipboard"> = {}): Promise<InsertionResult> {
  const clipboard = deps.clipboard ?? (await import("electron")).clipboard;
  clipboard.writeText(text);
  return { method: "clipboard", status: "copied" };
}

async function runMacPasteCommand() {
  await execFileAsync("osascript", ["-e", 'tell application "System Events" to keystroke "v" using command down'], {
    timeout: 2000
  });
}

async function runMacAccessibilityInsertCommand(text: string) {
  const script = `
on run argv
  set insertionText to item 1 of argv
  tell application "System Events"
    set frontApp to first application process whose frontmost is true
    set focusedElement to value of attribute "AXFocusedUIElement" of frontApp
    try
      set currentValue to value of attribute "AXValue" of focusedElement as text
    on error
      error "insert.accessibility_unavailable"
    end try
    set selectionStart to length of currentValue
    set selectionLength to 0
    try
      set selectedRange to value of attribute "AXSelectedTextRange" of focusedElement
      set selectionStart to item 1 of selectedRange
      set selectionLength to item 2 of selectedRange
    end try
    set prefixText to ""
    set suffixText to ""
    if selectionStart > 0 then set prefixText to text 1 thru selectionStart of currentValue
    set suffixStart to selectionStart + selectionLength + 1
    if suffixStart <= (length of currentValue) then set suffixText to text suffixStart thru -1 of currentValue
    set value of attribute "AXValue" of focusedElement to prefixText & insertionText & suffixText
    try
      set value of attribute "AXSelectedTextRange" of focusedElement to {selectionStart + (length of insertionText), 0}
    end try
  end tell
end run
`.trim();

  await execFileAsync("osascript", ["-e", script, text], { timeout: 2000 });
}

function delay(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}
