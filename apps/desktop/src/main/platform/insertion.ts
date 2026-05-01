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
}

export interface InsertionResult {
  method: "clipboard_paste" | "clipboard";
  status: "inserted" | "copied";
}

export async function pasteTextWithClipboardFallback(text: string, deps: InsertionDeps = {}): Promise<InsertionResult> {
  const clipboard = deps.clipboard ?? (await import("electron")).clipboard;
  const runPaste = deps.runPaste ?? runMacPasteCommand;

  clipboard.readText();
  clipboard.writeText(text);

  try {
    await runPaste();
    return { method: "clipboard_paste", status: "inserted" };
  } catch {
    return { method: "clipboard", status: "copied" };
  }
}

async function runMacPasteCommand() {
  await execFileAsync("osascript", ["-e", 'tell application "System Events" to keystroke "v" using command down'], {
    timeout: 2000
  });
}
