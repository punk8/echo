import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export interface ClipboardLike {
  readText: () => string;
  writeText: (text: string) => void;
}

export interface InsertionDeps {
  clipboard?: ClipboardLike;
  runPaste?: () => Promise<void>;
  sleep?: (ms: number) => Promise<void>;
  restoreDelayMs?: number;
}

export interface InsertionResult {
  method: "clipboard_paste" | "clipboard";
  status: "inserted" | "copied";
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

function delay(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}
