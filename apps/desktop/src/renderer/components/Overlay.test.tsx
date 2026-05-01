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

  it("shows finalizing state explicitly", () => {
    const markup = renderToStaticMarkup(<Overlay state={{ status: "finalizing" }} />);

    expect(markup).toContain("Finalizing");
    expect(markup).toContain("Preparing audio");
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
