import { shell, systemPreferences } from "electron";

export type PermissionValue = "granted" | "denied" | "restricted" | "unknown" | "not-determined";

export interface PermissionStatusSnapshot {
  microphone: PermissionValue;
  accessibility: "granted" | "denied";
}

export interface PermissionDeps {
  systemPreferences?: {
    getMediaAccessStatus: (mediaType: "microphone") => PermissionValue;
    askForMediaAccess?: (mediaType: "microphone") => Promise<boolean>;
    isTrustedAccessibilityClient: (prompt: boolean) => boolean;
  };
  shell?: {
    openExternal: (url: string) => Promise<unknown>;
  };
}

const microphoneSettingsUrl = "x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone";
const accessibilitySettingsUrl = "x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility";

export function getPermissionStatus(deps: PermissionDeps = {}): PermissionStatusSnapshot {
  const preferences = deps.systemPreferences ?? systemPreferences;
  return {
    microphone: preferences.getMediaAccessStatus("microphone"),
    accessibility: preferences.isTrustedAccessibilityClient(false) ? "granted" : "denied"
  };
}

export async function requestMicrophonePermission(deps: PermissionDeps = {}): Promise<PermissionStatusSnapshot> {
  const preferences = deps.systemPreferences ?? systemPreferences;
  const shellApi = deps.shell ?? shell;
  await preferences.askForMediaAccess?.("microphone");
  const status = getPermissionStatus({ systemPreferences: preferences });
  if (status.microphone === "denied" || status.microphone === "restricted") {
    await shellApi.openExternal(microphoneSettingsUrl);
  }
  return status;
}

export async function requestAccessibilityPermission(deps: PermissionDeps = {}): Promise<PermissionStatusSnapshot> {
  const preferences = deps.systemPreferences ?? systemPreferences;
  const shellApi = deps.shell ?? shell;
  preferences.isTrustedAccessibilityClient(true);
  const status = getPermissionStatus({ systemPreferences: preferences });
  if (status.accessibility === "denied") {
    await shellApi.openExternal(accessibilitySettingsUrl);
  }
  return status;
}
