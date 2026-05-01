import { describe, expect, it } from "vitest";
import { createHistoryRepository } from "./historyRepository";
import { useTempDatabase } from "./testDb";

describe("historyRepository", () => {
  const temp = useTempDatabase();

  it("inserts completed dictation rows and lists newest first", () => {
    const repo = createHistoryRepository(temp.db);
    repo.insertHistoryRow({
      id: "older",
      status: "completed",
      raw_text: "um hello",
      refined_text: "Hello.",
      audio_local_path: "/tmp/older.webm",
      duration_ms: 1000,
      language: "en",
      focused_app_name: "TextEdit",
      focused_app_bundle_id: "com.apple.TextEdit",
      focused_app_window_title: "Untitled",
      insertion_method: "clipboard_paste",
      insertion_status: "inserted",
      provider_asr: "openai:gpt-4o-transcribe",
      provider_llm: "openai-compatible:gpt-4o",
      error_code: null,
      timing_json: "{\"total_ms\":2000}"
    });
    repo.insertHistoryRow({
      id: "newer",
      status: "completed",
      raw_text: "um tomorrow at seven no make it three",
      refined_text: "Tomorrow at three.",
      audio_local_path: "/tmp/newer.webm",
      duration_ms: 1200,
      language: "en",
      focused_app_name: "TextEdit",
      focused_app_bundle_id: "com.apple.TextEdit",
      focused_app_window_title: "Untitled",
      insertion_method: "clipboard_paste",
      insertion_status: "inserted",
      provider_asr: "openai:gpt-4o-transcribe",
      provider_llm: "openai-compatible:gpt-4o",
      error_code: null,
      timing_json: "{\"total_ms\":2400}"
    });

    const rows = repo.listHistory();

    expect(rows.map((row) => row.id)).toEqual(["newer", "older"]);
    expect(rows[0]?.refined_text).toBe("Tomorrow at three.");
    expect(rows[0]?.provider_asr).toBe("openai:gpt-4o-transcribe");
  });
});
