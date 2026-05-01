import { describe, expect, it, vi } from "vitest";
import { getPermissionStatus, requestAccessibilityPermission, requestMicrophonePermission } from "./permissions";

describe("platform permissions", () => {
  it("reads microphone and accessibility permission status", () => {
    const status = getPermissionStatus({
      systemPreferences: {
        getMediaAccessStatus: vi.fn(() => "granted" as const),
        isTrustedAccessibilityClient: vi.fn(() => false)
      }
    });

    expect(status).toEqual({
      microphone: "granted",
      accessibility: "denied"
    });
  });

  it("requests microphone access and returns the new status", async () => {
    const status = await requestMicrophonePermission({
      systemPreferences: {
        askForMediaAccess: vi.fn().mockResolvedValue(true),
        getMediaAccessStatus: vi.fn(() => "granted" as const),
        isTrustedAccessibilityClient: vi.fn(() => true)
      }
    });

    expect(status.microphone).toBe("granted");
  });

  it("opens macOS microphone settings when microphone access is already denied", async () => {
    const openExternal = vi.fn().mockResolvedValue(undefined);

    const status = await requestMicrophonePermission({
      systemPreferences: {
        askForMediaAccess: vi.fn().mockResolvedValue(false),
        getMediaAccessStatus: vi.fn(() => "denied" as const),
        isTrustedAccessibilityClient: vi.fn(() => true)
      },
      shell: { openExternal }
    });

    expect(openExternal).toHaveBeenCalledWith("x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone");
    expect(status.microphone).toBe("denied");
  });

  it("opens the macOS accessibility prompt", async () => {
    const trusted = vi.fn(() => false);

    const result = await requestAccessibilityPermission({
      systemPreferences: {
        getMediaAccessStatus: vi.fn(() => "granted" as const),
        isTrustedAccessibilityClient: trusted
      },
      shell: { openExternal: vi.fn().mockResolvedValue(undefined) }
    });

    expect(trusted).toHaveBeenCalledWith(true);
    expect(result.accessibility).toBe("denied");
  });

  it("opens macOS accessibility settings when accessibility is still denied after the prompt", async () => {
    const openExternal = vi.fn().mockResolvedValue(undefined);

    const result = await requestAccessibilityPermission({
      systemPreferences: {
        getMediaAccessStatus: vi.fn(() => "granted" as const),
        isTrustedAccessibilityClient: vi.fn(() => false)
      },
      shell: { openExternal }
    });

    expect(openExternal).toHaveBeenCalledWith("x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility");
    expect(result.accessibility).toBe("denied");
  });
});
