import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { canRetryHistoryRow, HistoryPage } from "./HistoryPage";

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

  it("shows recording duration and output length for rows", () => {
    const markup = renderToStaticMarkup(
      <HistoryPage
        history={[
          {
            id: "session-1",
            created_at: "2026-05-02T00:00:00.000Z",
            updated_at: "2026-05-02T00:00:00.000Z",
            status: "completed",
            raw_text: "um tomorrow at seven no make it three",
            refined_text: "Tomorrow at three.",
            audio_local_path: "/tmp/session-1.webm",
            duration_ms: 1234,
            output_length: 18,
            language: "en",
            focused_app_name: "TextEdit",
            focused_app_bundle_id: "com.apple.TextEdit",
            focused_app_window_title: "Untitled",
            insertion_method: "clipboard_paste",
            insertion_status: "inserted",
            provider_asr: "openai:gpt-4o-transcribe",
            provider_llm: "openai-compatible:gpt-4o",
            error_code: null,
            timing_json: "{}"
          }
        ]}
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

    expect(markup).toContain("1.2s");
    expect(markup).toContain("18 chars");
  });

  it("only enables retry when a failed or cancelled row has retained audio", () => {
    const retryable = {
      ...createHistoryRow("failed-1"),
      status: "error",
      refined_text: "",
      audio_local_path: "/tmp/failed-1.webm",
      insertion_method: "none",
      insertion_status: "not_inserted",
      error_code: "server.refine_failed"
    };
    const completed = createHistoryRow("completed-1");

    expect(canRetryHistoryRow(retryable)).toBe(true);
    expect(canRetryHistoryRow(completed)).toBe(false);
    expect(canRetryHistoryRow({ ...retryable, audio_local_path: null })).toBe(false);
  });
});

function createHistoryRow(id: string) {
  return {
    id,
    created_at: "2026-05-02T00:00:00.000Z",
    updated_at: "2026-05-02T00:00:00.000Z",
    status: "completed",
    raw_text: "um tomorrow at seven no make it three",
    refined_text: "Tomorrow at three.",
    audio_local_path: `/tmp/${id}.webm`,
    duration_ms: 1234,
    output_length: 18,
    language: "en",
    focused_app_name: "TextEdit",
    focused_app_bundle_id: "com.apple.TextEdit",
    focused_app_window_title: "Untitled",
    insertion_method: "clipboard_paste",
    insertion_status: "inserted",
    provider_asr: "openai:gpt-4o-transcribe",
    provider_llm: "openai-compatible:gpt-4o",
    error_code: null,
    timing_json: "{}"
  };
}
