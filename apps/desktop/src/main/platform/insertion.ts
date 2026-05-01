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

export interface ComposeTextInsertionInput {
  currentValue: string;
  selectionStart: number;
  selectionLength: number;
  insertionText: string;
}

export interface ComposeTextInsertionResult {
  value: string;
  cursorOffset: number;
}

export function composeTextInsertion(input: ComposeTextInsertionInput): ComposeTextInsertionResult {
  const selectionStart = clamp(input.selectionStart, 0, input.currentValue.length);
  const selectionEnd = clamp(selectionStart + input.selectionLength, selectionStart, input.currentValue.length);
  const prefixText = input.currentValue.slice(0, selectionStart);
  const suffixText = input.currentValue.slice(selectionEnd);
  const leadingSpace = shouldAddLeadingSpace(prefixText, input.insertionText) ? " " : "";
  const trailingSpace = shouldAddTrailingSpace(input.insertionText, suffixText) ? " " : "";
  const normalizedInsertion = `${leadingSpace}${input.insertionText}${trailingSpace}`;

  return {
    value: `${prefixText}${normalizedInsertion}${suffixText}`,
    cursorOffset: prefixText.length + normalizedInsertion.length
  };
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
    if my shouldAddLeadingSpace(prefixText, insertionText) then set insertionText to " " & insertionText
    if my shouldAddTrailingSpace(insertionText, suffixText) then set insertionText to insertionText & " "
    set value of attribute "AXValue" of focusedElement to prefixText & insertionText & suffixText
    try
      set value of attribute "AXSelectedTextRange" of focusedElement to {selectionStart + (length of insertionText), 0}
    end try
  end tell
end run

on shouldAddLeadingSpace(prefixText, insertionText)
  if prefixText is "" or insertionText is "" then return false
  set leftChar to last character of prefixText
  set rightChar to first character of insertionText
  if my isWhitespace(leftChar) or my isWhitespace(rightChar) then return false
  if my isClosingPunctuation(rightChar) then return false
  if my isOpeningPunctuation(leftChar) then return false
  if my isAsciiWord(rightChar) and (my isAsciiWord(leftChar) or my isClosingPunctuation(leftChar)) then return true
  return false
end shouldAddLeadingSpace

on shouldAddTrailingSpace(insertionText, suffixText)
  if insertionText is "" or suffixText is "" then return false
  set leftChar to last character of insertionText
  set rightChar to first character of suffixText
  if my isWhitespace(leftChar) or my isWhitespace(rightChar) then return false
  if my isClosingPunctuation(rightChar) then return false
  if my isOpeningPunctuation(leftChar) then return false
  if my isAsciiWord(rightChar) and (my isAsciiWord(leftChar) or my isClosingPunctuation(leftChar)) then return true
  return false
end shouldAddTrailingSpace

on isWhitespace(value)
  return value is " " or value is tab or value is linefeed or value is return
end isWhitespace

on isAsciiWord(value)
  set codePoint to id of value
  return (codePoint >= 48 and codePoint <= 57) or (codePoint >= 65 and codePoint <= 90) or (codePoint >= 97 and codePoint <= 122)
end isAsciiWord

on isClosingPunctuation(value)
  return value is "." or value is "," or value is "!" or value is "?" or value is ";" or value is ":" or value is "%" or value is ")" or value is "]" or value is "}"
end isClosingPunctuation

on isOpeningPunctuation(value)
  return value is "(" or value is "[" or value is "{" or value is "/" or value is "-" or value is "'"
end isOpeningPunctuation
`.trim();

  await execFileAsync("osascript", ["-e", script, text], { timeout: 2000 });
}

function shouldAddLeadingSpace(prefixText: string, insertionText: string) {
  const leftChar = lastCharacter(prefixText);
  const rightChar = firstCharacter(insertionText);
  if (!leftChar || !rightChar || isWhitespace(leftChar) || isWhitespace(rightChar)) {
    return false;
  }
  if (isClosingPunctuation(rightChar) || isOpeningPunctuation(leftChar)) {
    return false;
  }
  return isWordCharacter(rightChar) && (isWordCharacter(leftChar) || isClosingPunctuation(leftChar));
}

function shouldAddTrailingSpace(insertionText: string, suffixText: string) {
  const leftChar = lastCharacter(insertionText);
  const rightChar = firstCharacter(suffixText);
  if (!leftChar || !rightChar || isWhitespace(leftChar) || isWhitespace(rightChar)) {
    return false;
  }
  if (isClosingPunctuation(rightChar) || isOpeningPunctuation(leftChar)) {
    return false;
  }
  return isWordCharacter(rightChar) && (isWordCharacter(leftChar) || isClosingPunctuation(leftChar));
}

function firstCharacter(value: string) {
  return Array.from(value)[0] ?? "";
}

function lastCharacter(value: string) {
  const characters = Array.from(value);
  return characters.at(-1) ?? "";
}

function isWhitespace(value: string) {
  return /\s/u.test(value);
}

function isWordCharacter(value: string) {
  return /[\p{L}\p{N}]/u.test(value);
}

function isClosingPunctuation(value: string) {
  return /[.,!?;:%)\]}]/u.test(value);
}

function isOpeningPunctuation(value: string) {
  return /[([{/"'-]/u.test(value);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function delay(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}
