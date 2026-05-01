import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { HistoryPage } from "./HistoryPage";

describe("HistoryPage", () => {
  it("offers a clear all action for local history", () => {
    const markup = renderToStaticMarkup(
      <HistoryPage
        history={[]}
        settings={{
          historyRetention: "1_week",
          shortcut: "Alt+Space",
          language: "auto",
          microphoneDeviceId: "system",
          interactionSounds: true,
          muteOtherAudioWhileDictating: false,
          launchAtLogin: false,
          showDockIcon: true,
          outputStyle: "balanced"
        }}
        onRetentionChange={vi.fn()}
        onCopy={vi.fn()}
        onDelete={vi.fn()}
        onRetry={vi.fn()}
        onClear={vi.fn()}
      />
    );

    expect(markup).toContain("Clear All");
  });
});
