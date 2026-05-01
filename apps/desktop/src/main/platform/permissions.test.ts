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

  it("opens the macOS accessibility prompt", () => {
    const trusted = vi.fn(() => false);

    const result = requestAccessibilityPermission({
      systemPreferences: {
        getMediaAccessStatus: vi.fn(() => "granted" as const),
        isTrustedAccessibilityClient: trusted
      }
    });

    expect(trusted).toHaveBeenCalledWith(true);
    expect(result.accessibility).toBe("denied");
  });
});
