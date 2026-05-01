import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { getHomeCommandState, HomePage } from "./HomePage";

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

describe("HomePage", () => {
  it("shows exact provider configuration gaps on the dashboard", () => {
    const markup = renderToStaticMarkup(
      <HomePage
        state={{ status: "idle" }}
        settings={settings}
        history={[]}
        providerStatus={{
          reachable: false,
          apiBaseUrl: "http://127.0.0.1:43110",
          errorCode: "config.llm_model_missing"
        }}
        onToggle={vi.fn()}
      />
    );

    expect(markup).toContain("Local API offline");
    expect(markup).toContain("LLM configuration missing");
    expect(markup).toContain("LLM_MODEL");
    expect(markup).not.toContain("LLM_API_KEY");
  });

  it("disables the command button while dictation is busy outside recording", () => {
    const markup = renderToStaticMarkup(
      <HomePage
        state={{ status: "processing", sessionId: "session-1" }}
        settings={settings}
        history={[]}
        providerStatus={{ reachable: true, apiBaseUrl: "http://127.0.0.1:43110" }}
        onToggle={vi.fn()}
      />
    );

    expect(getHomeCommandState({ status: "recording", sessionId: "session-1" })).toEqual({
      label: "Finish",
      disabled: false
    });
    expect(getHomeCommandState({ status: "processing", sessionId: "session-1" })).toEqual({
      label: "Processing",
      disabled: true
    });
    expect(markup).toContain("Processing");
    expect(markup).toContain("disabled");
  });
});
