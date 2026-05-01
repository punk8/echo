import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { SettingsPage } from "./SettingsPage";

const settings = {
  historyRetention: "1_week" as const,
  shortcut: "Alt+Space",
  language: "auto",
  microphoneDeviceId: "system",
  interactionSounds: true,
  muteOtherAudioWhileDictating: false,
  launchAtLogin: false,
  showDockIcon: true,
  outputStyle: "balanced" as const
};

describe("SettingsPage permissions", () => {
  it("shows microphone and accessibility permission states", () => {
    const markup = renderToStaticMarkup(
      <SettingsPage
        settings={settings}
        providerStatus={{ reachable: true, apiBaseUrl: "http://127.0.0.1:43110" }}
        permissions={{ microphone: "granted", accessibility: "denied" }}
        onSave={vi.fn()}
        onRestoreDefaultShortcut={vi.fn()}
        onRequestMicrophone={vi.fn()}
        onRequestAccessibility={vi.fn()}
      />
    );

    expect(markup).toContain("Microphone Permission");
    expect(markup).toContain("Accessibility Permission");
    expect(markup).toContain("Granted");
    expect(markup).toContain("Denied");
  });
});
