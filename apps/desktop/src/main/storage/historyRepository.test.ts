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

  it("clears all history rows", () => {
    const repo = createHistoryRepository(temp.db);
    repo.insertHistoryRow(createHistoryRow("row-1"));
    repo.insertHistoryRow(createHistoryRow("row-2"));

    const deletedAudioPaths = repo.clearHistory();

    expect(repo.listHistory()).toEqual([]);
    expect(deletedAudioPaths).toEqual(["/tmp/row-1.webm", "/tmp/row-2.webm"]);
  });

  it("deletes one history row and returns its audio path", () => {
    const repo = createHistoryRepository(temp.db);
    repo.insertHistoryRow(createHistoryRow("row-1"));
    repo.insertHistoryRow(createHistoryRow("row-2"));

    const deletedAudioPaths = repo.deleteHistoryRow("row-1");

    expect(repo.listHistory().map((row) => row.id)).toEqual(["row-2"]);
    expect(deletedAudioPaths).toEqual(["/tmp/row-1.webm"]);
  });

  it("prunes rows older than the selected retention window", () => {
    const repo = createHistoryRepository(temp.db);
    repo.insertHistoryRow(createHistoryRow("old"));
    repo.insertHistoryRow(createHistoryRow("new"));
    temp.db
      .prepare("UPDATE dictation_history SET created_at = ? WHERE id = ?")
      .run("2026-04-20T00:00:00.000Z", "old");
    temp.db
      .prepare("UPDATE dictation_history SET created_at = ? WHERE id = ?")
      .run("2026-05-01T00:00:00.000Z", "new");

    const deletedAudioPaths = repo.pruneHistory("1_week", new Date("2026-05-02T00:00:00.000Z"));

    expect(repo.listHistory().map((row) => row.id)).toEqual(["new"]);
    expect(deletedAudioPaths).toEqual(["/tmp/old.webm"]);
  });

  it("returns all audio paths when retention removes every row", () => {
    const repo = createHistoryRepository(temp.db);
    repo.insertHistoryRow(createHistoryRow("row-1"));
    repo.insertHistoryRow(createHistoryRow("row-2"));

    const deletedAudioPaths = repo.pruneHistory("never");

    expect(repo.listHistory()).toEqual([]);
    expect(deletedAudioPaths).toEqual(["/tmp/row-1.webm", "/tmp/row-2.webm"]);
  });
});

function createHistoryRow(id: string) {
  return {
    id,
    status: "completed",
    raw_text: "um hello",
    refined_text: "Hello.",
    audio_local_path: `/tmp/${id}.webm`,
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
  };
}
