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
- Extracted renderer code shows a primary WebSocket endpoint shaped like `/ws/rt_voice_flow`.
- Extracted renderer code shows WebSocket client messages such as `start_audio`, `set_audio_chunk_info`, `replace_audio_context`, `set_mode_config`, binary audio chunks, and `end_audio`.
- Extracted renderer code shows server events such as `transcription`, `received_audio_chunk_count`, `audio_processing_completed`, `refine_completed`, and `debug_info`.
- Extracted main-process code shows an HTTP fallback endpoint shaped like `POST /ai/voice_flow`, sending `audio_id`, `mode`, `audio_file`, `audio_context`, `audio_metadata`, timing fields, retry flag, device name, and mode parameters.
- Extracted client code shows a fallback race: if the WebSocket final result is slow or degraded, the client compresses the full audio and calls the HTTP fallback path.
- Extracted client code shows Opus/Ogg chunk compression and a default chunk interval around 3 seconds.
- Extracted client code shows a user-edit learning path shaped like `POST /user/traits`, where the app compares inserted refined text with the user's later edits and may receive auto-added dictionary terms.
- The client did not visibly connect directly to OpenAI, Deepgram, AssemblyAI, or other third-party model providers. Visible traffic went to AWS Global Accelerator and local proxy.
- Local metadata did not expose readable `asr_duration`, `refine_duration`, or `provider`.
- No local `.mlmodel`, `.onnx`, `.tflite`, `.gguf`, `.ggml`, `.safetensors`, or Whisper-like model artifact was found in the installed app bundle.

Architecture implication:

- The client should be responsible for recording, compression, context capture, upload session management, insertion, and local history.
- The cloud should be responsible for ASR and dictation refinement.
- The primary cloud path should be WebSocket-based realtime audio streaming.
- The product should include an HTTP full-audio fallback for weak networks, slow finalization, retries, and provider failures.
- The provider behind Typeless cannot be confirmed from the local client. Our implementation must keep ASR and LLM providers replaceable.

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
  Realtime session gateway
  HTTP fallback endpoint
  ASR provider router
  Dictation refiner service
  User edit learning service
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
- Focused accessibility role.
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

The backend should be designed as a realtime dictation pipeline with a full-audio fallback. This matches the strongest Typeless evidence: a realtime WebSocket flow, chunk metadata, binary audio chunks, server-side transcription events, final refinement events, and a separate HTTP fallback endpoint.

### 7.1 Primary Realtime Protocol

The primary path is a single dictation session over WebSocket.

```text
Client
  -> WSS /v1/dictation/realtime?session_token=...

Client -> Server
  start_audio
    audio_id
    mode = dictation
    audio_context
    audio_metadata
    language_settings
    dictionary_snapshot
    style_settings

Client -> Server
  binary audio chunk
  set_audio_chunk_info
    audio_id
    index
    size
    duration_ms

Client -> Server
  replace_audio_context
    audio_id
    audio_context

Client -> Server
  end_audio
    audio_id
    user_over_time
    send_time
    client_metadata

Server -> Client
  received_audio_chunk_count
  transcription
  process_mode
  refine_completed
  audio_processing_completed
  error
```

Rules:

- `start_audio` opens a server-side session and binds it to an `audio_id`.
- Audio chunks are sent while recording is active, ideally every 1-3 seconds.
- `set_audio_chunk_info` lets the backend validate chunk ordering, duration, and missing chunks.
- `replace_audio_context` can update context after the initial capture if the client gets better Accessibility data.
- `end_audio` tells the server to finalize ASR and run the dictation refiner.
- The server may emit partial `transcription` messages, but the client should insert only the final `refine_completed` text.
- The final result must be idempotent by `audio_id`; retries must not create duplicate insertions.

### 7.2 HTTP Fallback Protocol

The fallback path sends the full compressed audio after recording ends or when realtime finalization is degraded.

```text
POST /v1/dictation/voice-flow
Content-Type: multipart/form-data

audio_id
mode = dictation
audio_file = audio.ogg
audio_context = encrypted or redacted JSON
audio_metadata = JSON
language_settings = JSON
dictionary_snapshot = JSON
style_settings = JSON
user_over_time
send_time
is_retry
device_name
parameters = JSON
```

Response:

```json
{
  "data": {
    "refine_text": "明天下午三点和 Alex 开会。",
    "delivery": "replace",
    "debug": {
      "session_id": "uuid",
      "path": "fallback"
    }
  }
}
```

Fallback triggers:

- WebSocket is unavailable.
- Network is offline and reconnects after recording.
- Chunk compression takes too long.
- Final WebSocket result exceeds the configured timeout.
- The user retries a failed or cancelled dictation from History.
- The backend asks the client to downgrade because chunk processing is unhealthy.

### 7.3 Audio Chunking and Compression

Client requirements:

- Capture mono PCM from the microphone.
- Store the full local recording for History if retention settings allow it.
- Prefer Opus/Ogg for network upload.
- Keep a full-audio buffer so fallback can compress and send the complete session.
- Track per-chunk duration, byte size, index, and compression timing.

Initial defaults:

```text
sample_rate: 16000 Hz
channels: 1
container: ogg
codec: opus
chunk_interval: 3000 ms
target_bitrate: 16 kbps
```

The exact sample rate may change based on ASR provider requirements. Provider-specific format conversion should happen behind `AudioEncodingAdapter`, not in product logic.

### 7.4 Session Metadata Payload

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
  "dictionary": ["Echo", "Typeless"],
  "style": {
    "mode": "balanced",
    "preserve_spoken_style": false
  }
}
```

### 7.5 Backend Components

```text
RealtimeGateway
  accepts WebSocket sessions
  validates auth and session tokens
  receives metadata and chunks
  forwards chunks to ASRSession
  emits partial and final events

FallbackVoiceFlowEndpoint
  accepts multipart full-audio requests
  reconstructs a DictationSession
  runs final ASR and refiner
  returns refine_text

ASRProviderRouter
  chooses streaming or batch provider
  normalizes provider output into ASRResult
  handles provider failover

DictationRefiner
  converts raw ASR transcript into final written text
  returns structured edits and risk flags

ResultValidator
  checks preservation of names, numbers, dates, dictionary terms, and user intent
  can downgrade to lightly normalized transcript

UserEditLearningService
  receives post-insertion edit signals
  extracts durable preferences and dictionary candidates
```

### 7.6 ASR Service

Responsibilities:

- Convert audio to raw transcript.
- Detect language.
- Preserve timestamps or segment boundaries if available.
- Return confidence if provider supports it.
- Support streaming partial results where provider allows it.
- Support final full-audio transcription for fallback and retries.

Provider abstraction:

```text
ASRProvider
  startStreamingSession(session) -> StreamingASRSession
  transcribeFinal(audio, metadata) -> ASRResult

StreamingASRSession
  appendChunk(chunk, chunkInfo)
  finish() -> ASRResult
  cancel()

ASRResult
  text
  language
  segments[]
  confidence
  provider_metadata
```

First implementation should use a cloud ASR provider. The provider must be replaceable because Typeless's client does not reveal its server-side ASR provider.

### 7.7 Dictation Refiner

Responsibilities:

- Convert raw transcript into polished dictation text.
- Remove filler words and repetition.
- Resolve self-corrections.
- Add punctuation and capitalization.
- Add paragraphs and lists when implied.
- Improve clarity without changing meaning.
- Preserve dictionary terms, names, numbers, dates, and technical terms.

The refiner is not a general writing assistant. It is a constrained text transformation service.

Input:

```json
{
  "raw_text": "嗯我们明天七点开会不对改成三点然后发给 Alex",
  "segments": [
    { "text": "嗯我们明天七点开会", "start_ms": 0, "end_ms": 2400 },
    { "text": "不对改成三点然后发给 Alex", "start_ms": 2400, "end_ms": 5200 }
  ],
  "language": "zh-CN",
  "app_category": "email",
  "dictionary": ["Alex"],
  "style": "balanced",
  "nearby_text": "",
  "user_preferences": {
    "tone": "concise",
    "preserve_spoken_style": false
  }
}
```

Output:

```json
{
  "final_text": "我们明天三点开会，然后发给 Alex。",
  "format": "paragraph",
  "edits": [
    {
      "type": "filler_removed",
      "removed": "嗯"
    },
    {
      "type": "self_correction",
      "removed": "七点",
      "kept": "三点"
    },
    {
      "type": "punctuation_added"
    }
  ],
  "risk": "low",
  "confidence": 0.91,
  "warnings": []
}
```

### 7.8 Dictation Intelligence Implementation

The Typeless-like "polished dictation" behavior should be implemented as a multi-stage refiner pipeline, not as a single unconstrained prompt.

```text
ASRResult
  -> DisfluencyCleaner
  -> RepetitionCleaner
  -> RepairResolver
  -> StructureDetector
  -> LLMStyleRefiner
  -> ResultValidator
  -> RefinedDictationResult
```

#### DisfluencyCleaner

Removes filler words and verbal hesitation when they are not semantically meaningful.

Examples:

- Chinese: `嗯`, `呃`, `就是`, `那个`, repeated `然后`.
- English: `um`, `uh`, `like`, `you know`, `I mean` when used as hesitation.

Implementation:

- Language-specific filler lexicons.
- Segment timing and confidence checks to avoid deleting intended words.
- LLM confirmation only when removal is ambiguous.

#### RepetitionCleaner

Removes accidental short-range repetitions.

Examples:

```text
raw: 我们明天明天三点开会
final: 我们明天三点开会。
```

Implementation:

- Token n-gram repetition detection for 1-5 token windows.
- Time-distance guardrails so intentional repeated emphasis is preserved.
- Dictionary and capitalization preservation after deletion.

#### RepairResolver

Resolves self-corrections and keeps only the final intent.

Repair cues:

```text
zh-CN: 不, 不对, 不是, 改成, 应该是, 我的意思是, 重新说, 删掉刚才
en-US: no, actually, I mean, make that, sorry, change it to, scratch that
```

Examples:

```text
raw: 明天七点，不，改成三点。
final: 明天三点。

raw: Send it to Sarah, no, send it to Alex.
final: Send it to Alex.
```

Implementation:

- Detect repair cue spans.
- Identify the nearest replaceable target before the cue.
- Prefer same-entity replacement: time replaces time, number replaces number, name replaces name, noun phrase replaces noun phrase.
- For complex cases, ask the LLM to return structured edit operations:

```json
{
  "operation": "replace",
  "target": "明天七点",
  "replacement": "明天三点",
  "reason": "self_correction"
}
```

Guardrail:

- If the target span is uncertain, keep a lightly cleaned transcript rather than applying a risky correction.

#### StructureDetector

Detects whether spoken content should become a paragraph, bullet list, numbered list, steps, short note, or task list.

Signals:

- `第一`, `第二`, `首先`, `然后`, `最后`, `有三点`, `列几个点`.
- `one`, `two`, `first`, `second`, `next`, `finally`, `three things`.
- Explicit layout words such as `换行`, `下一行`, `冒号`, `bullet point`, `new paragraph`.

Example:

```text
raw: 有三点 第一速度要快 第二要稳定 第三要记住专有名词
final:
有三点：

1. 速度要快
2. 要稳定
3. 记住专有名词
```

Implementation:

- Rule-based structure hints.
- LLM formatting pass constrained by the detected structure.
- Validator checks that list item count is not invented.

#### LLMStyleRefiner

Improves clarity and word choice under a strict transformation contract.

Supported styles:

- `literal`: close to the spoken words; only clean fillers, punctuation, and obvious repeats.
- `balanced`: default; natural written text while preserving speaker intent.
- `polished`: smoother and more formal, but still no new facts.

Hard constraints:

- Do not add facts.
- Do not change numbers, dates, names, amounts, URLs, code, product names, or dictionary terms.
- Do not turn dictation into an action unless the mode is explicitly command-oriented.
- Do not expand into an email, article, or summary unless the user dictated that instruction as content.

#### ResultValidator

Checks the LLM result before returning it to the client.

Validation checks:

- Names and dictionary terms are preserved or intentionally corrected.
- Numbers, dates, times, amounts, and units match the resolved intent.
- List item counts match the transcript.
- Final text is not much longer than the spoken content unless formatting requires it.
- The model did not add claims, recipients, links, or tasks.

Fallback behavior:

- `risk = low`: return refined text.
- `risk = medium`: return refined text with internal warning for telemetry.
- `risk = high`: return lightly normalized ASR text and mark `server.refine_degraded`.

### 7.9 Fast Path and Quality Path

To approach Typeless-level perceived speed, the backend should use routing:

- Fast path: short, simple dictations with high ASR confidence.
- Quality path: longer dictations, self-corrections, list-like content, mixed language, low ASR confidence.
- Fallback path: ASR succeeded but refinement failed; return lightly normalized transcript with an error flag.

The product should never block insertion on slow nonessential analysis.

Recommended routing:

```text
Fast path
  condition:
    duration <= 12s
    no repair cues
    no list signals
    high ASR confidence
  action:
    punctuation + light cleanup + small LLM or deterministic normalizer

Quality path
  condition:
    repair cues OR list signals OR mixed language OR low ASR confidence OR duration > 12s
  action:
    full refiner pipeline

Fallback path
  condition:
    refiner timeout OR provider error
  action:
    lightly normalized transcript
```

### 7.10 Provider Configuration

API keys must not be committed or pasted into source files. Provider configuration should be environment-based.

```env
ASR_PROVIDER=
ASR_API_KEY=
ASR_BASE_URL=
ASR_STREAMING_MODEL=
ASR_BATCH_MODEL=

LLM_PROVIDER=
LLM_API_KEY=
LLM_BASE_URL=
LLM_FAST_MODEL=
LLM_QUALITY_MODEL=

DICTATION_REFINER_TIMEOUT_MS=8000
DICTATION_FALLBACK_TIMEOUT_MS=20000
```

Provider interfaces:

```text
ProviderRouter
  selectASR(session) -> ASRProvider
  selectRefiner(session, asrResult, hints) -> LLMProvider

LLMProvider
  refineDictation(request) -> RefinedDictationResult
```

### 7.11 User Edit Learning

After final text is inserted, the client should observe whether the user edits it shortly afterward. This is a learning signal, not a raw training dump.

Capture window:

- Start after successful insertion.
- Stop after timeout, focus loss, or clear user inactivity.
- Compare inserted refined text with the current text field content.

Payload to backend:

```json
{
  "audio_id": "uuid",
  "refined_inserted_text": "明天下午三点和 Alex 开会。",
  "original_input_box": {
    "text_before_cursor": "",
    "text_after_cursor": ""
  },
  "edited_input_box": {
    "changed_excerpt": "明天下午 3 点和 Alex 开会。"
  },
  "active_application": {
    "app_name": "TextEdit",
    "app_identifier": "com.apple.TextEdit"
  }
}
```

Backend output:

```json
{
  "preferences": [
    {
      "type": "format_preference",
      "rule": "prefer Arabic numerals for times"
    }
  ],
  "dictionary_candidates": [
    {
      "term": "Alex",
      "source": "user_edit"
    }
  ]
}
```

Rules:

- Do not store complete private documents.
- Store durable preferences and dictionary candidates, not raw long-form content.
- Let users disable personalization and clear learned preferences.
- Use edit learning only to improve future dictation and dictionary suggestions.

### 7.12 Timing Metadata

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
- WebSocket connect duration.
- Audio chunk ack latency.
- Missing or out-of-order chunk count.
- ASR duration.
- Refiner duration.
- Result validation downgrade rate.
- WebSocket vs fallback winner rate.
- Total session duration.
- ASR provider error rate.
- Refiner provider error rate.
- Text length and audio duration buckets.
- User edit learning trigger rate.

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
    realtimeGateway.ts
    fallbackVoiceFlowRoute.ts
    sessionStore.ts
    audioChunkAssembler.ts
    providerRouter.ts
    asr/
      ASRProvider.ts
      StreamingASRSession.ts
      providers/
    refiner/
      DictationRefiner.ts
      DisfluencyCleaner.ts
      RepetitionCleaner.ts
      RepairResolver.ts
      StructureDetector.ts
      LLMStyleRefiner.ts
      ResultValidator.ts
    learning/
      userEditLearningRoute.ts
      preferenceExtractor.ts
```

## 14. Implementation Phases

### Phase 1: Local Dictation Loop

- Electron app shell.
- Overlay.
- Configurable shortcut, using a reliable fallback if `Fn` capture is not ready.
- Audio recording.
- HTTP full-audio upload.
- Cloud ASR and dictation refiner.
- Text insertion into TextEdit and Notes.
- Local history.
- Provider configuration through local `.env`, without committing API keys.

### Phase 2: Typeless-like Responsiveness

- WebSocket realtime session gateway.
- Opus/Ogg chunk upload during recording.
- Session finalize protocol with `end_audio`.
- HTTP fallback race for weak networks and slow finalization.
- Better processing state labels.
- Fast path vs quality path routing.
- Compatibility matrix across browser, chat, email, and editor apps.

### Phase 3: Production Hardening

- Opus/Ogg encoder hardening.
- Accessibility insertion improvements.
- Clipboard fallback polish.
- Dictionary integration.
- User edit learning and dictionary candidate review.
- Retention policy enforcement.
- Observability dashboards.

## 15. Open Decisions

- Whether the default shortcut is `Fn` or a more reliable fallback such as `Option+Space`.
- Whether we implement `Fn` capture through N-API, sidecar process, or another native bridge.
- Whether the first ASR provider supports chunked upload or only finalize-after-recording.
- Whether the backend uses one model for both ASR and refinement or separate providers.
- Which ASR provider is used for streaming and which provider is used for batch fallback.
- Which LLM models are used for fast path and quality path refinement.
- Whether user edit learning is enabled by default or opt-in.
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
