import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { HomePage } from "./HomePage";

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
});
