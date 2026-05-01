import type { DictationState } from "@echo/shared";
import type { ProviderStatus } from "../../main/dictation/providerStatus";
import type { HistoryRow } from "../../main/storage/historyRepository";
import type { EchoSettings } from "../../main/storage/settingsRepository";

export function HomePage({
  state,
  settings,
  history,
  providerStatus,
  onToggle
}: {
  state: DictationState;
  settings: EchoSettings;
  history: HistoryRow[];
  providerStatus: ProviderStatus;
  onToggle: () => void;
}) {
  const recent = history.slice(0, 4);
  const completedCount = history.filter((row) => row.status === "completed").length;
  const insertedCount = history.filter((row) => row.insertion_status === "inserted").length;

  return (
    <section className="page-stack">
      <header className="page-header">
        <div>
          <p className="eyebrow">Mac dictation</p>
          <h1>Press once to start, press again to finish.</h1>
        </div>
        <button type="button" className="command-button" onClick={onToggle}>
          {state.status === "recording" ? "Finish" : "Start"}
        </button>
      </header>

      <div className="status-grid">
        <section className="panel">
          <span className="panel-label">Shortcut</span>
          <strong>{settings.shortcut}</strong>
          <small>{state.status}</small>
        </section>
        <section className="panel">
          <span className="panel-label">Provider</span>
          <strong>{providerStatus.reachable ? "Local API reachable" : "Local API offline"}</strong>
          <small>{formatProviderDetail(providerStatus)}</small>
        </section>
        <section className="panel">
          <span className="panel-label">Usage</span>
          <strong>
            {completedCount}/{history.length}
          </strong>
          <small>{insertedCount} inserted</small>
        </section>
      </div>

      <section className="table-section">
        <div className="section-heading">
          <h2>Recent Dictation</h2>
        </div>
        <div className="history-list compact">
          {recent.length === 0 ? <p className="empty-state">No dictation yet.</p> : null}
          {recent.map((row) => (
            <article key={row.id} className="history-row">
              <div>
                <strong>{row.refined_text || row.raw_text || row.error_code}</strong>
                <span>{row.focused_app_name}</span>
              </div>
              <time>{formatTime(row.created_at)}</time>
            </article>
          ))}
        </div>
      </section>
    </section>
  );
}

function formatProviderDetail(providerStatus: ProviderStatus) {
  if (providerStatus.asr && providerStatus.llm) {
    return `${providerStatus.asr} / ${providerStatus.llm}`;
  }
  return providerStatus.apiBaseUrl;
}

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
