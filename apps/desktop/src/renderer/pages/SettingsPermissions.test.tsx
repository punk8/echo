import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { SettingsPage } from "./SettingsPage";

describe("SettingsPage permissions", () => {
  it("shows microphone and accessibility permission states", () => {
    const markup = renderToStaticMarkup(
      <SettingsPage
        settings={{ historyRetention: "1_week", shortcut: "Alt+Space", language: "auto" }}
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
