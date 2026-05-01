import type { HistoryRow } from "../../main/storage/historyRepository";
import type { EchoSettings, HistoryRetention } from "../../main/storage/settingsRepository";

export function HistoryPage({
  history,
  settings,
  onRetentionChange,
  onCopy,
  onDelete,
  onRetry,
  onClear
}: {
  history: HistoryRow[];
  settings: EchoSettings;
  onRetentionChange: (retention: HistoryRetention) => void;
  onCopy: (text: string) => void;
  onDelete: (id: string) => void;
  onRetry: (id: string) => void;
  onClear: () => void;
}) {
  return (
    <section className="page-stack">
      <header className="page-header compact-header">
        <div>
          <p className="eyebrow">Review</p>
          <h1>History</h1>
        </div>
        <div className="header-actions">
          <label className="field-inline">
            Retention
            <select value={settings.historyRetention} onChange={(event) => onRetentionChange(event.target.value as HistoryRetention)}>
              <option value="24_hours">24 hours</option>
              <option value="1_week">1 week</option>
              <option value="1_month">1 month</option>
              <option value="forever">Forever</option>
              <option value="never">Never</option>
            </select>
          </label>
          <button type="button" className="secondary-button" onClick={onClear}>
            Clear All
          </button>
        </div>
      </header>

      <section className="privacy-summary" aria-labelledby="history-privacy-heading">
        <div>
          <p className="eyebrow">Retention</p>
          <h2 id="history-privacy-heading">Local history</h2>
        </div>
        <ul>
          <li>History is stored locally on this Mac and follows the retention setting above.</li>
          <li>Audio is still sent to the configured providers for processing during each dictation.</li>
        </ul>
      </section>

      <section className="table-section">
        <div className="history-list">
          {history.length === 0 ? <p className="empty-state">No saved rows.</p> : null}
          {history.map((row) => (
            <article key={row.id} className="history-row full">
              <div className="row-main">
                <strong>{row.refined_text || row.raw_text || row.error_code}</strong>
                <span>
                  {formatDate(row.created_at)} · {row.focused_app_name} · {formatDuration(row.duration_ms)} ·{" "}
                  {row.output_length} chars · {row.provider_asr}
                </span>
              </div>
              <span className={`status-chip ${row.insertion_status}`}>{row.insertion_status}</span>
              <div className="row-actions">
                <button
                  type="button"
                  disabled={!canRetryHistoryRow(row)}
                  title={canRetryHistoryRow(row) ? "Retry retained recording" : "Retry unavailable without a failed retained recording"}
                  onClick={() => onRetry(row.id)}
                >
                  Retry
                </button>
                <button type="button" onClick={() => onCopy(row.refined_text || row.raw_text)}>
                  Copy
                </button>
                <button type="button" onClick={() => onDelete(row.id)}>
                  Delete
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>
    </section>
  );
}

export function canRetryHistoryRow(row: HistoryRow) {
  return (row.status === "error" || row.status === "cancelled") && Boolean(row.audio_local_path);
}

function formatDate(value: string) {
  return new Date(value).toLocaleString([], { month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function formatDuration(value: number) {
  return `${(value / 1000).toFixed(1)}s`;
}
