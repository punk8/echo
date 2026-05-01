import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { DictationContext } from "@echo/shared";

const execFileAsync = promisify(execFile);
const maxNearbyTextLength = 500;

export interface ActiveApplicationInput {
  appName?: string;
  bundleId?: string;
  windowTitle?: string;
  nearbyText?: string;
  selectionPresent?: boolean;
  focusedRole?: string;
  focusedValueSettable?: boolean;
}

export function buildFallbackContext(input: ActiveApplicationInput = {}): DictationContext {
  const appName = sanitize(input.appName) ?? "Unknown App";
  const writable = resolveWritable(input);
  return {
    app_name: appName,
    bundle_id: sanitize(input.bundleId) ?? `unknown.${slugify(appName)}`,
    window_title: sanitize(input.windowTitle) ?? "",
    ...(input.focusedRole ? { focused_role: input.focusedRole } : {}),
    writable,
    selection_present: input.selectionPresent ?? false,
    nearby_text: writable ? sanitizeNearbyText(input.nearbyText) : ""
  };
}

export async function captureContext(): Promise<DictationContext> {
  try {
    const app = await getFrontmostApplication();
    return buildFallbackContext(app);
  } catch {
    return buildFallbackContext();
  }
}

async function getFrontmostApplication(): Promise<ActiveApplicationInput> {
  const script = [
    'tell application "System Events"',
    'set frontApp to first application process whose frontmost is true',
    'set appName to name of frontApp',
    'set bundleId to bundle identifier of frontApp',
    'set windowTitle to ""',
    'set focusedRole to ""',
    'set focusedValueSettable to "false"',
    'set selectionPresent to "false"',
    'set nearbyText to ""',
    'try',
    'set windowTitle to name of front window of frontApp',
    'end try',
    'try',
    'set focusedElement to value of attribute "AXFocusedUIElement" of frontApp',
    'set focusedRole to value of attribute "AXRole" of focusedElement',
    'try',
    'set nearbyText to value of attribute "AXValue" of focusedElement as text',
    `if (length of nearbyText) > ${maxNearbyTextLength} then set nearbyText to text 1 thru ${maxNearbyTextLength} of nearbyText`,
    'end try',
    'try',
    'set focusedValueSettable to (settable of attribute "AXValue" of focusedElement) as string',
    'end try',
    'try',
    'set selectedText to value of attribute "AXSelectedText" of focusedElement',
    'if selectedText is not "" then set selectionPresent to "true"',
    'end try',
    'end try',
    'return appName & linefeed & bundleId & linefeed & windowTitle & linefeed & focusedRole & linefeed & focusedValueSettable & linefeed & selectionPresent & linefeed & nearbyText',
    'end tell'
  ].join("\n");

  const { stdout } = await execFileAsync("osascript", ["-e", script], { timeout: 1500 });
  const [appName, bundleId, windowTitle, focusedRole, focusedValueSettable, selectionPresent, ...nearbyTextLines] = stdout
    .trimEnd()
    .split("\n");
  return {
    ...(appName ? { appName } : {}),
    ...(bundleId ? { bundleId } : {}),
    ...(windowTitle ? { windowTitle } : {}),
    ...(focusedRole ? { focusedRole } : {}),
    ...(focusedValueSettable ? { focusedValueSettable: parseAppleScriptBoolean(focusedValueSettable) } : {}),
    ...(selectionPresent ? { selectionPresent: parseAppleScriptBoolean(selectionPresent) } : {}),
    ...(nearbyTextLines.length > 0 ? { nearbyText: nearbyTextLines.join("\n") } : {})
  };
}

function resolveWritable(input: ActiveApplicationInput) {
  if (input.focusedRole) {
    return input.focusedValueSettable === true || isWritableRole(input.focusedRole);
  }
  return true;
}

function isWritableRole(role: string) {
  return role === "AXTextArea" || role === "AXTextField" || role === "AXComboBox";
}

function parseAppleScriptBoolean(value: string) {
  return value.trim().toLowerCase() === "true";
}

function sanitize(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function sanitizeNearbyText(value: string | undefined) {
  return sanitize(value)?.slice(0, maxNearbyTextLength) ?? "";
}

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ".").replace(/^\.+|\.+$/g, "") || "app";
}
