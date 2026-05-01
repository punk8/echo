# Electron Mac Dictation Technical Spec

Status: Draft
Date: 2026-05-02
Scope: macOS dictation-only implementation, using Electron as the desktop shell and preserving a path to future Windows support.

## 1. Purpose

This document defines the technical design for a Typeless-like dictation product focused on one scenario:

1. User focuses a writable text field in a macOS app.
2. User presses the dictation shortcut once to start recording.
3. User speaks the content they want to write.
4. User presses the shortcut again to stop.
5. The system converts speech into polished written text.
6. The desktop app inserts the result at the current cursor.
7. The result is saved in local history.

This spec is based on:

- Product requirements: `docs/requirements/mac-dictation-requirements.md`
- Typeless UX and pipeline research: `docs/research/typeless-mac-ux-teardown.md`

## 2. Why Electron

We will use Electron for the desktop shell.

Reasons:

- Typeless itself appears to use Electron, based on the observed `app.asar`, renderer HTML files, Electron helper processes, and Electron metadata.
- Electron lets us reuse and adapt reference interaction patterns and assets more directly than a pure native app.
- Future Windows support will need a shared UI, settings, history, onboarding, and network pipeline. Electron keeps those surfaces portable.
- The core OS integrations can be isolated behind native helper modules, which can later have Windows equivalents.

Tradeoff:

- Electron alone is not enough for global `Fn` capture, reliable text insertion, Accessibility context, and low-level audio behavior. We need native helpers for the system layer.

## 3. Reference Findings From Typeless

Confirmed or strongly supported by local research:

- Typeless is packaged as Electron.
- It uses native helper libraries with names aligned to keyboard, context, input, and utility work.
- It records local `.ogg` files and has `enabledOpusCompression: true`.
- Its local SQLite history schema includes `refined_text`, `audio_local_path`, `focused_app_*`, `ax_text`, `ax_html`, `mode`, and metadata fields.
- A controlled network test showed outbound bytes during the recording window, before or near local audio file completion.
- The client did not visibly connect directly to OpenAI, Deepgram, AssemblyAI, or other third-party model providers. Visible traffic went to AWS Global Accelerator and local proxy.
- Local metadata did not expose readable `asr_duration`, `refine_duration`, or `provider`.

Architecture implication:

- The client should be responsible for recording, compression, context capture, upload session management, insertion, and local history.
- The cloud should be responsible for ASR and dictation refinement.
- The upload path should support recording-time upload, not only post-recording upload.

## 4. High-Level Architecture

```text
Electron Desktop App
  Main Process
    App lifecycle
    Window management
    IPC orchestration
    Settings and local DB coordination
    Dictation session state machine

  Renderer Processes
    Hub window
    Floating dictation overlay
    Settings
    History
    Dictionary

  Native Helpers
    Keyboard helper
    Audio helper
    Context helper
    Input helper
    Optional media/Opus helper

Local Storage
  SQLite history DB
  Audio recording files
  Settings JSON or SQLite table
  Dictionary DB/table

Cloud Backend
  Upload/session gateway
  ASR service
  Dictation refiner service
  Usage/observability
```

## 5. Client Modules

### 5.1 Main Process

Responsibilities:

- Start the app and enforce single-instance behavior.
- Create and manage windows:
  - Hub window.
  - Floating overlay window.
  - Optional onboarding window.
- Own the dictation session state machine.
- Coordinate native helper calls.
- Own upload session lifecycle.
- Persist local history and settings.
- Expose safe IPC APIs to renderers.

Main process should be the only layer allowed to:

- Start or stop native recording.
- Insert text.
- Access local DB directly.
- Access auth tokens.
- Call backend APIs.

### 5.2 Renderer: Hub

Responsibilities:

- Show the product's control surface.
- Explain the default shortcut.
- Show history and dictionary.
- Show settings.
- Show privacy and local retention information.

The Hub is not the primary writing surface.

### 5.3 Renderer: Floating Overlay

Responsibilities:

- Show recording and processing state.
- Display waveform or audio level.
- Provide cancel and finish controls.
- Display errors and fallback actions.

Overlay states:

- `idle`
- `recording`
- `finalizing`
- `processing`
- `inserting`
- `complete`
- `error`

The overlay must distinguish recording from processing. Typeless's observed processing state is not self-explanatory enough; our overlay should include a short state label.

### 5.4 Native Keyboard Helper

Purpose:

- Capture the global dictation shortcut.
- Support macOS `Fn` if technically feasible.
- Report key down/up events to the main process with low latency.

Implementation options:

- Native Node addon.
- N-API module.
- Small native sidecar process.

Mac likely requires lower-level event monitoring than Electron's built-in `globalShortcut` for reliable `Fn` behavior. If `Fn` is not reliable, the default shortcut should fall back to a configurable chord such as `Option+Space`, while preserving `Fn` as an advanced option.

### 5.5 Native Audio Helper

Purpose:

- Capture microphone audio.
- Provide low-latency recording state.
- Encode audio for local storage and upload.

Requirements:

- Mono audio.
- Configurable sample rate, default 16 kHz or 24 kHz depending on provider requirements.
- Voice level frames for overlay waveform.
- Chunked upload support.
- Local file output.
- Microphone device selection.

Encoding:

- Preferred: Opus/Ogg, matching Typeless's apparent design and upload efficiency.
- Acceptable first implementation: M4A/AAC if backend provider compatibility makes it simpler.

### 5.6 Native Context Helper

Purpose:

- Capture limited local context at dictation start.

Context fields:

- Active app name.
- Active app bundle id.
- Front window title.
- Browser URL/domain/title when safely available.
- Focused element writable status.
- Optional nearby text only if accessible and bounded.

This helper must not capture full screen or full document content.

### 5.7 Native Input Helper

Purpose:

- Insert final dictation text into the target focused element.

Insertion strategy:

1. Prefer direct Accessibility insertion where possible.
2. Fall back to clipboard + synthetic paste.
3. If focus changed or target is unsafe, copy to clipboard and show manual paste fallback.

The helper must preserve enough target identity from dictation start to avoid inserting into the wrong app after focus changes.

## 6. Dictation State Machine

```text
idle
  -> preparing
  -> recording
  -> finalizing
  -> processing
  -> inserting
  -> complete
  -> idle

error can be entered from preparing, recording, finalizing, processing, or inserting.
cancelled can be entered from recording or finalizing.
```

State definitions:

- `preparing`: validate permissions, create session, capture initial target context.
- `recording`: audio capture active; chunks may upload; overlay shows waveform.
- `finalizing`: second shortcut press received; finalize audio stream; prevent new chunks.
- `processing`: waiting for ASR/refiner result.
- `inserting`: final text received; attempt insertion.
- `complete`: insertion or fallback completed.
- `error`: show recovery action.

Critical rules:

- Only one dictation session may run at a time.
- The target context must be captured at start.
- The final text must not be inserted into a different target unless explicitly safe.
- Retry must not duplicate insertion.

## 7. Cloud Pipeline

### 7.1 Session Protocol

The client should treat dictation as a session.

```text
POST /v1/dictation/sessions
  -> session_id, upload_url or websocket endpoint

stream chunks or PUT chunks

POST /v1/dictation/sessions/{id}/finalize
  -> final result or async result handle
```

The first version may use a simpler multipart upload after recording ends. The target architecture should support chunked upload during recording because Typeless evidence strongly suggests pre-finish network activity.

### 7.2 Upload Payload

Session metadata:

```json
{
  "session_id": "uuid",
  "client": {
    "platform": "macos",
    "app_version": "0.1.0"
  },
  "audio": {
    "codec": "opus",
    "container": "ogg",
    "sample_rate": 16000,
    "channels": 1
  },
  "language": {
    "preferred": "zh-CN",
    "auto_detect": true
  },
  "context": {
    "focused_app_name": "TextEdit",
    "focused_app_bundle_id": "com.apple.TextEdit",
    "window_title": "Untitled",
    "app_category": "note"
  },
  "dictionary": ["Echo", "Typeless"]
}
```

### 7.3 ASR Service

Responsibilities:

- Convert audio to raw transcript.
- Detect language.
- Preserve timestamps or segment boundaries if available.
- Return confidence if provider supports it.

Provider abstraction:

```text
ASRProvider
  transcribe(session) -> ASRResult
```

First implementation should use a cloud ASR provider. The provider must be replaceable.

### 7.4 Dictation Refiner

Responsibilities:

- Convert raw transcript into polished dictation text.
- Remove filler words and repetition.
- Resolve self-corrections.
- Add punctuation and capitalization.
- Add paragraphs and lists when implied.
- Improve clarity without changing meaning.
- Preserve dictionary terms, names, numbers, dates, and technical terms.

Input:

```json
{
  "raw_text": "嗯我们明天七点开会不对改成三点然后发给 Alex",
  "language": "zh-CN",
  "app_category": "email",
  "dictionary": ["Alex"],
  "style": "balanced"
}
```

Output:

```json
{
  "final_text": "我们明天三点开会，然后发给 Alex。",
  "operations": [
    "removed_filler",
    "resolved_self_correction",
    "added_punctuation"
  ],
  "confidence": 0.91
}
```

The refiner must be a constrained text transformation service, not a general chat endpoint.

### 7.5 Fast Path and Quality Path

To approach Typeless-level perceived speed, the backend should use routing:

- Fast path: short, simple dictations with high ASR confidence.
- Quality path: longer dictations, self-corrections, list-like content, mixed language, low ASR confidence.
- Fallback path: ASR succeeded but refinement failed; return lightly normalized transcript with an error flag.

The product should never block insertion on slow nonessential analysis.

### 7.6 Timing Metadata

Our backend should expose timing internally even if Typeless does not expose it locally.

Recommended internal metrics:

- `upload_started_at`
- `upload_finalized_at`
- `asr_started_at`
- `asr_finished_at`
- `refine_started_at`
- `refine_finished_at`
- `response_sent_at`

Client-facing debug mode may show coarse timings for development builds only.

## 8. Local Storage

Use SQLite for durable local state.

### 8.1 History Table

```sql
CREATE TABLE dictation_history (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL,
  final_text TEXT,
  raw_text TEXT,
  audio_local_path TEXT,
  duration_ms INTEGER,
  detected_language TEXT,
  focused_app_name TEXT,
  focused_app_bundle_id TEXT,
  focused_app_window_title TEXT,
  focused_app_window_web_domain TEXT,
  insertion_status TEXT,
  error_code TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

Fields intentionally mirror Typeless's observed concepts but use clearer names.

### 8.2 Settings Table or JSON

Required settings:

- Dictation shortcut.
- Microphone device.
- Interaction sounds.
- Mute background audio.
- Launch at login.
- Show in Dock.
- History retention.
- Output style: literal, balanced, polished.
- Preferred language and auto-detect setting.

### 8.3 Dictionary Table

```sql
CREATE TABLE dictionary_entries (
  id TEXT PRIMARY KEY,
  term TEXT NOT NULL,
  aliases TEXT,
  pronunciation_hint TEXT,
  capitalization TEXT,
  language TEXT,
  source TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

Dictionary entries should be sent to the backend as bounded context, not as an unbounded user profile.

## 9. Security and Privacy

Client rules:

- Do not log dictation text by default.
- Do not log audio file paths with sensitive content in analytics.
- Keep history local unless sync is explicitly added later.
- Allow retention settings: never, 24 hours, 1 week, 1 month, forever.
- Delete local recordings according to retention policy.
- Separate "local history retention" from "cloud processing retention" in UI copy.

Backend rules:

- Do not store audio or transcript after returning the result unless explicitly enabled for debugging with user consent.
- Do not use dictations for model training without explicit opt-in.
- Encrypt in transit.
- Use zero-retention agreements where third-party model providers are used.

## 10. Error Handling

Required error classes:

- `permission.microphone_missing`
- `permission.accessibility_missing`
- `shortcut.conflict`
- `target.no_writable_field`
- `audio.no_speech_detected`
- `audio.device_unavailable`
- `network.unavailable`
- `server.asr_failed`
- `server.refine_failed`
- `insert.failed`
- `insert.focus_changed`

Every error must include:

- User-facing message.
- Recovery action.
- Whether generated text exists.
- Clipboard fallback when text exists.

## 11. Observability

Client metrics:

- Shortcut press to recording state latency.
- Recording duration.
- Stop press to final result latency.
- Stop press to insertion latency.
- Insertion success rate by app.
- Fallback usage.
- Permission failure count.

Backend metrics:

- Upload duration.
- ASR duration.
- Refiner duration.
- Total session duration.
- ASR provider error rate.
- Refiner provider error rate.
- Text length and audio duration buckets.

Metrics must not include raw dictation content.

## 12. Platform Abstraction for Windows

The Electron app should define OS-facing interfaces from the start:

```text
KeyboardAdapter
AudioAdapter
ContextAdapter
InputAdapter
PermissionsAdapter
```

Mac implementations:

- `MacKeyboardAdapter`
- `MacAudioAdapter`
- `MacContextAdapter`
- `MacInputAdapter`
- `MacPermissionsAdapter`

Future Windows implementations:

- `WindowsKeyboardAdapter`
- `WindowsAudioAdapter`
- `WindowsContextAdapter`
- `WindowsInputAdapter`
- `WindowsPermissionsAdapter`

Renderer and backend contracts should not depend on macOS-specific APIs.

## 13. Suggested Project Structure

```text
apps/desktop/
  src/main/
    app.ts
    windows/
    dictation/
      DictationSessionController.ts
      DictationStateMachine.ts
      UploadClient.ts
    storage/
    ipc/
  src/renderer/
    hub/
    overlay/
    settings/
    history/
  native/
    mac/
      keyboard-helper/
      audio-helper/
      context-helper/
      input-helper/
    windows/
      README.md
  shared/
    types/
    protocol/

services/api/
  src/dictation/
    sessionRoutes.ts
    ASRProvider.ts
    DictationRefiner.ts
    providers/
```

## 14. Implementation Phases

### Phase 1: Local Dictation Loop

- Electron app shell.
- Overlay.
- Configurable shortcut, using a reliable fallback if `Fn` capture is not ready.
- Audio recording.
- Stop-to-upload.
- Cloud ASR and refiner.
- Text insertion into TextEdit and Notes.
- Local history.

### Phase 2: Typeless-like Responsiveness

- Chunked upload during recording.
- Session finalize protocol.
- Better processing state labels.
- Fast path vs quality path routing.
- Compatibility matrix across browser, chat, email, and editor apps.

### Phase 3: Production Hardening

- Opus/Ogg encoder hardening.
- Accessibility insertion improvements.
- Clipboard fallback polish.
- Dictionary integration.
- Retention policy enforcement.
- Observability dashboards.

## 15. Open Decisions

- Whether the default shortcut is `Fn` or a more reliable fallback such as `Option+Space`.
- Whether we implement `Fn` capture through N-API, sidecar process, or another native bridge.
- Whether the first ASR provider supports chunked upload or only finalize-after-recording.
- Whether the backend uses one model for both ASR and refinement or separate providers.
- Whether local audio files are retained by default.
- Whether final text is inserted automatically or previewed first for long dictations.

## 16. Non-Goals

This technical spec does not cover:

- Ask anything.
- Selected-text editing.
- Translation mode.
- Web search.
- Mobile apps.
- Billing.
- Team management.
- Enterprise admin.

