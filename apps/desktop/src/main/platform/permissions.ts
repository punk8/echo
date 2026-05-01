import { systemPreferences } from "electron";

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
}

export function getPermissionStatus(deps: PermissionDeps = {}): PermissionStatusSnapshot {
  const preferences = deps.systemPreferences ?? systemPreferences;
  return {
    microphone: preferences.getMediaAccessStatus("microphone"),
    accessibility: preferences.isTrustedAccessibilityClient(false) ? "granted" : "denied"
  };
}

export async function requestMicrophonePermission(deps: PermissionDeps = {}): Promise<PermissionStatusSnapshot> {
  const preferences = deps.systemPreferences ?? systemPreferences;
  await preferences.askForMediaAccess?.("microphone");
  return getPermissionStatus({ systemPreferences: preferences });
}

export function requestAccessibilityPermission(deps: PermissionDeps = {}): PermissionStatusSnapshot {
  const preferences = deps.systemPreferences ?? systemPreferences;
  preferences.isTrustedAccessibilityClient(true);
  return getPermissionStatus({ systemPreferences: preferences });
}
