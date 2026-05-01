import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { SettingsPage } from "./SettingsPage";

describe("SettingsPage", () => {
  it("offers restoring the default shortcut", () => {
    const markup = renderToStaticMarkup(
      <SettingsPage
        settings={{ historyRetention: "1_week", shortcut: "CommandOrControl+Space", language: "auto" }}
        onSave={vi.fn()}
        onRestoreDefaultShortcut={vi.fn()}
      />
    );

    expect(markup).toContain("Restore Default");
  });
});
