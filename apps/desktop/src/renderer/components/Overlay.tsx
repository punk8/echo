export type OverlayState =
  | {
      status: "recording";
      elapsedMs: number;
      levelSamples: number[];
      onCancel: () => void;
      onFinish: () => void;
    }
  | { status: "finalizing"; onCancel: () => void }
  | { status: "processing"; stageText?: string }
  | { status: "inserting" }
  | { status: "copied" }
  | { status: "complete" }
  | {
      status: "error";
      message: string;
      recoverableText?: string;
      recoveryActionLabel?: string;
      onRecoveryAction?: () => void;
      onRetry: () => void;
      onCopy: () => void;
      onDismiss: () => void;
    };

export function Overlay({ state }: { state: OverlayState }) {
  return (
    <div className={`overlay overlay-${state.status}`} role="status" aria-live="polite">
      {state.status === "recording" ? (
        <>
          <div className="overlay-status">
            <span className="pulse-dot" aria-hidden="true" />
            <span>{formatElapsed(state.elapsedMs)}</span>
          </div>
          <div className="waveform" aria-label="Input level">
            {Array.from({ length: 18 }).map((_, index) => {
              const level = state.levelSamples[index % Math.max(1, state.levelSamples.length)] ?? 0.12;
              return <span key={index} style={{ height: `${Math.max(14, level * 44)}px` }} />;
            })}
          </div>
          <div className="overlay-actions">
            <button type="button" className="ghost-button" onClick={state.onCancel}>
              Cancel
            </button>
            <button type="button" className="primary-button" onClick={state.onFinish}>
              Finish
            </button>
          </div>
        </>
      ) : null}

      {state.status === "finalizing" ? (
        <>
          <OverlayMessage title="Finalizing" detail="Preparing audio" />
          <div className="overlay-actions">
            <button type="button" className="ghost-button" onClick={state.onCancel}>
              Cancel
            </button>
          </div>
        </>
      ) : null}
      {state.status === "processing" ? (
        <OverlayMessage title="Processing" detail={state.stageText ?? "Refining dictation"} />
      ) : null}
      {state.status === "inserting" ? <OverlayMessage title="Inserting" detail="Pasting into the active app" /> : null}
      {state.status === "copied" ? <OverlayMessage title="Copied" detail="Paste manually with Command+V" /> : null}
      {state.status === "complete" ? <OverlayMessage title="Inserted" detail="Ready for the next dictation" /> : null}

      {state.status === "error" ? (
        <>
          <OverlayMessage title="Could not finish" detail={state.message} />
          {state.recoverableText ? (
            <div className="recoverable-transcript">
              <strong>Unrefined transcript</strong>
              <span>{state.recoverableText}</span>
            </div>
          ) : null}
          <div className="overlay-actions">
            {state.recoveryActionLabel && state.onRecoveryAction ? (
              <button type="button" className="ghost-button" onClick={state.onRecoveryAction}>
                {state.recoveryActionLabel}
              </button>
            ) : null}
            <button type="button" className="ghost-button" onClick={state.onRetry}>
              Retry
            </button>
            <button type="button" className="ghost-button" onClick={state.onCopy}>
              Copy
            </button>
            <button type="button" className="primary-button" onClick={state.onDismiss}>
              Dismiss
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}

function OverlayMessage({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="overlay-message">
      <span className="spinner" aria-hidden="true" />
      <div>
        <strong>{title}</strong>
        <span>{detail}</span>
      </div>
    </div>
  );
}

function formatElapsed(value: number) {
  const totalSeconds = Math.floor(value / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}
