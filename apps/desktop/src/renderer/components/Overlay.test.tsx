import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { Overlay } from "./Overlay";

describe("Overlay", () => {
  it("shows elapsed time, waveform label, Cancel, and Finish while recording", () => {
    const markup = renderToStaticMarkup(
      <Overlay state={{ status: "recording", elapsedMs: 7200, levelSamples: [0.2, 0.6], onCancel: vi.fn(), onFinish: vi.fn() }} />
    );

    expect(markup).toContain("00:07");
    expect(markup).toContain("Input level");
    expect(markup).toContain("Cancel");
    expect(markup).toContain("Finish");
  });

  it("shows processing state explicitly", () => {
    const markup = renderToStaticMarkup(<Overlay state={{ status: "processing" }} />);

    expect(markup).toContain("Processing");
  });

  it("shows provider stage text while processing", () => {
    const markup = renderToStaticMarkup(
      <Overlay state={{ status: "processing", stageText: "Transcribing audio and refining text" }} />
    );

    expect(markup).toContain("Processing");
    expect(markup).toContain("Transcribing audio and refining text");
  });

  it("shows finalizing state explicitly with a cancel action", () => {
    const markup = renderToStaticMarkup(<Overlay state={{ status: "finalizing", onCancel: vi.fn() }} />);

    expect(markup).toContain("Finalizing");
    expect(markup).toContain("Preparing audio");
    expect(markup).toContain("Cancel");
  });

  it("shows a manual paste instruction when text was copied instead of inserted", () => {
    const markup = renderToStaticMarkup(<Overlay state={{ status: "copied" }} />);

    expect(markup).toContain("Copied");
    expect(markup).toContain("Command+V");
  });

  it("shows Retry, Copy, and Dismiss actions on error", () => {
    const markup = renderToStaticMarkup(
      <Overlay
        state={{
          status: "error",
          message: "Speech recognition failed.",
          onRetry: vi.fn(),
          onCopy: vi.fn(),
          onDismiss: vi.fn()
        }}
      />
    );

    expect(markup).toContain("Retry");
    expect(markup).toContain("Copy");
    expect(markup).toContain("Dismiss");
  });

  it("shows a recovery action on permission errors", () => {
    const markup = renderToStaticMarkup(
      <Overlay
        state={{
          status: "error",
          message: "Accessibility permission is required.",
          recoveryActionLabel: "Open Accessibility Settings",
          onRecoveryAction: vi.fn(),
          onRetry: vi.fn(),
          onCopy: vi.fn(),
          onDismiss: vi.fn()
        }}
      />
    );

    expect(markup).toContain("Open Accessibility Settings");
  });

  it("labels recoverable raw transcript text as unrefined", () => {
    const markup = renderToStaticMarkup(
      <Overlay
        state={{
          status: "error",
          message: "Dictation refinement failed.",
          recoverableText: "um tomorrow at seven no actually three",
          onRetry: vi.fn(),
          onCopy: vi.fn(),
          onDismiss: vi.fn()
        }}
      />
    );

    expect(markup).toContain("Unrefined transcript");
    expect(markup).toContain("um tomorrow at seven");
  });
});
