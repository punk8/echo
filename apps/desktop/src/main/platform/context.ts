import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { DictationContext } from "@echo/shared";

const execFileAsync = promisify(execFile);

export interface ActiveApplicationInput {
  appName?: string;
  bundleId?: string;
  windowTitle?: string;
  nearbyText?: string;
  selectionPresent?: boolean;
}

export function buildFallbackContext(input: ActiveApplicationInput = {}): DictationContext {
  const appName = sanitize(input.appName) ?? "Unknown App";
  return {
    app_name: appName,
    bundle_id: sanitize(input.bundleId) ?? `unknown.${slugify(appName)}`,
    window_title: sanitize(input.windowTitle) ?? "",
    writable: true,
    selection_present: input.selectionPresent ?? false,
    nearby_text: input.nearbyText ?? ""
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
    'try',
    'set windowTitle to name of front window of frontApp',
    'end try',
    'return appName & linefeed & bundleId & linefeed & windowTitle',
    'end tell'
  ].join("\n");

  const { stdout } = await execFileAsync("osascript", ["-e", script], { timeout: 1500 });
  const [appName, bundleId, windowTitle] = stdout.trimEnd().split("\n");
  return {
    ...(appName ? { appName } : {}),
    ...(bundleId ? { bundleId } : {}),
    ...(windowTitle ? { windowTitle } : {})
  };
}

function sanitize(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ".").replace(/^\.+|\.+$/g, "") || "app";
}
