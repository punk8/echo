# Echo Real-Provider Mac Dictation App Spec

Status: Approved for implementation
Date: 2026-05-02
Scope: First complete macOS dictation application slice using Electron and real ASR/LLM providers only.

## 1. Problem

Echo needs to become a usable desktop dictation product, not only a set of research documents. The first product surface is macOS口述: the user focuses any writable field, presses a global shortcut once to start recording, speaks naturally, presses the shortcut again to stop, receives polished written text, and gets that text inserted back into the original app.

The implementation must use real cloud model providers. It must not ship a mock provider path for normal runtime dictation. Test doubles may exist only inside automated tests and must not be selectable from production configuration.

## 2. References

- Requirements: `docs/requirements/mac-dictation-requirements.md`
- UX teardown: `docs/research/typeless-mac-ux-teardown.md`
- Technical architecture: `docs/technical/electron-mac-dictation-technical-spec.md`
- OpenAI speech-to-text docs: `https://platform.openai.com/docs/guides/speech-to-text`
- OpenAI audio overview: `https://platform.openai.com/docs/guides/audio/quickstart`

## 3. Product Scope

Included in this slice:

- Electron desktop app for macOS.
- Hub window with Home, History, Dictionary, and Settings.
- Floating bottom overlay for recording, processing, insertion, complete, and error states.
- Global toggle-to-record shortcut.
- Microphone recording.
- Real ASR provider integration.
- Real LLM refinement provider integration.
- AI dictation cleanup: filler removal, repetition removal, self-correction handling, punctuation, capitalization, paragraphs, lists, and clarity edits.
- Text insertion into the focused macOS app.
- Clipboard fallback when direct insertion fails.
- Local history, settings, dictionary, and local recording paths.
- Local `.env` configuration for provider credentials.

Out of scope for this slice:

- Ask mode.
- Selected-text editing.
- Translation mode.
- Web search.
- Agentic actions.
- Billing, team admin, enterprise controls, and mobile apps.
- Realtime streaming ASR. The first implementation uploads the full recording after the stop shortcut.
- A production mock provider.

## 4. Provider Decisions

### 4.1 ASR

The first ASR implementation is OpenAI `gpt-4o-transcribe` through the Audio Transcriptions API.

Configuration:

- `ASR_PROVIDER`: `openai`
- `ASR_MODEL`: `gpt-4o-transcribe`
- `ASR_BASE_URL`: `https://api.openai.com/v1`
- `ASR_API_KEY`: required local secret value supplied through `.env`
- `ASR_LANGUAGE`: `auto`

Runtime behavior:

- The desktop client records one complete dictation audio file.
- The backend receives the audio file through Echo's own dictation API.
- The backend sends the audio file to the OpenAI transcription endpoint.
- The backend receives raw transcript text and optional metadata.
- The backend passes the raw transcript into the LLM refinement step.

Audio format:

- The client records `webm` when Electron's media stack supports it on the target macOS version.
- If `webm` recording is unavailable, the client records `wav`.
- The backend accepts both `webm` and `wav` and forwards the actual file format to the OpenAI transcription endpoint.
- The request field `audio_format` must always match the uploaded file.

Future ASR adapters:

- Deepgram Nova-3 for realtime multilingual streaming.
- Groq `whisper-large-v3-turbo` for low-latency full-file transcription.
- OpenAI Realtime transcription when the product moves to streaming.

### 4.2 LLM Refinement

The first implementation uses a real OpenAI-compatible text LLM adapter. The exact model is provided by local configuration rather than hardcoded in source.

Required configuration:

- `LLM_PROVIDER`: `openai-compatible`
- `LLM_MODEL`: required local model id supplied through `.env`
- `LLM_BASE_URL`: required local provider base URL supplied through `.env`
- `LLM_API_KEY`: required local secret value supplied through `.env`
- `LLM_TEMPERATURE`: `0.2`

Runtime behavior:

- If LLM configuration is missing, dictation must fail with `config.llm_missing`; it must not silently fall back to a mock or return raw ASR text as final output.
- If the managed local API reports a provider configuration startup error, the desktop app must block dictation before microphone recording starts and show the exact missing provider setting.
- If ASR succeeds but refinement fails, the app may show the raw transcript in the error recovery panel with Copy and Retry actions, but it must clearly label the result as unrefined.
- The product default remains polished dictation, not raw transcription.

## 5. User Flow

1. User launches Echo.
2. Echo checks microphone permission and Accessibility permission.
3. User focuses a writable field in another macOS app.
4. User presses the configured dictation shortcut once.
5. Echo captures active-app context and starts microphone recording.
6. The overlay appears near the bottom of the screen with waveform, elapsed time, cancel, and finish controls.
7. User speaks naturally.
8. User presses the shortcut again or clicks finish.
9. Echo stops recording and enters processing state.
10. Backend transcribes the audio with the real ASR provider.
11. Backend refines the raw transcript with the real LLM provider.
12. Echo inserts the refined text into the original writable target.
13. Echo records the session in local History according to retention settings.
14. Echo dismisses the overlay after a brief complete state.

## 6. Desktop Architecture

```text
apps/desktop
  Electron main process
    app lifecycle
    global shortcut
    dictation state machine
    local storage
    audio session control
    context capture
    insertion orchestration

  renderer
    Hub
    Overlay
    Settings
    History
    Dictionary

services/api
  dictation HTTP API
  ASR adapter
  LLM refinement adapter
  prompt and validation logic

packages/shared
  typed contracts
  dictation states
  provider result schemas
```

The Electron main process owns privileged work. Renderers call main through typed IPC and never receive provider keys.

## 7. Backend Architecture

The first backend path is HTTP full-audio processing:

```text
POST /v1/dictation/process
  multipart audio file
  session metadata
  app context
  dictionary terms
  style preferences

-> ASR adapter
-> dictation refiner
-> result validator
-> response
```

The backend must be a separate service process, even if it runs on the same machine. This keeps provider keys outside the Electron renderer and preserves a path to hosted backend deployment.

For local desktop use, the Electron main process should manage that local API service when `API_BASE_URL` is not explicitly set:

- If `API_BASE_URL` is set, Echo treats it as a user-managed or hosted backend and does not spawn a local API child process.
- If `API_BASE_URL` is unset, Echo starts the local API as a child process with the same provider environment variables as the desktop process.
- The desktop app checks `/health` before starting a child process, so an already-running local API on the configured host/port is reused.
- The desktop app should start the compiled API entry when build output exists, and fall back to the TypeScript development entry only when no compiled entry is available.
- Packaged macOS builds should carry a bundled API entry under app resources and prefer that packaged resource before workspace development paths. The packaged resource must be launched through the app's own Electron executable in Node mode, not through a user-installed `node` binary.
- The child process is terminated when the desktop app exits.
- Startup failures must be surfaced as provider status/config errors without exposing secrets in the UI or logs.

This keeps the implementation compatible with the development service model while making the desktop app usable without requiring a separate terminal command.

## 8. API Contracts

### 8.1 Request

`POST /v1/dictation/process`

Content type: `multipart/form-data`

Fields:

```json
{
  "session_id": "uuid",
  "audio": "file",
  "audio_format": "webm",
  "duration_ms": 7200,
  "language": "auto",
  "context": {
    "app_name": "TextEdit",
    "bundle_id": "com.apple.TextEdit",
    "window_title": "Untitled",
    "focused_role": "AXTextArea",
    "writable": true,
    "selection_present": false,
    "nearby_text": ""
  },
  "dictionary": [
    {
      "term": "Echo",
      "aliases": [],
      "case_sensitive": true,
      "source": "manual"
    }
  ],
  "preferences": {
    "style": "balanced",
    "output_language": "follow_input",
    "format_lists": true
  }
}
```

### 8.2 Success Response

```json
{
  "session_id": "uuid",
  "raw_text": "um let's meet tomorrow at seven no actually make that three",
  "refined_text": "Let's meet tomorrow at three.",
  "language": "en",
  "provider": {
    "asr": "openai:gpt-4o-transcribe",
    "llm": "openai-compatible:${LLM_MODEL}"
  },
  "timing": {
    "upload_received_at": "2026-05-02T12:00:00.000Z",
    "asr_ms": 1400,
    "refine_ms": 900,
    "total_ms": 2400
  },
  "quality": {
    "risk": "low",
    "warnings": []
  }
}
```

### 8.3 Error Response

```json
{
  "session_id": "uuid",
  "error": {
    "code": "server.asr_failed",
    "message": "Speech recognition failed.",
    "recoverable": true
  },
  "raw_text": ""
}
```

## 9. Dictation Refinement Contract

The refiner must transform ASR text into written text while preserving meaning.

Required behavior:

- Remove filler words and hesitations.
- Remove repeated words, repeated phrases, and duplicate sentences.
- Resolve obvious self-corrections such as "no", "actually", "I mean", "不对", "改成", and "我是说".
- Add punctuation and capitalization.
- Add paragraph breaks where appropriate.
- Convert spoken list signals into bullets, numbered lists, steps, or simple task lists.
- Improve clarity and word choice when intent is clear.
- Preserve names, numbers, dates, product names, technical terms, dictionary terms, and intentional repetition.
- Avoid adding facts, executing commands, translating, summarizing, or changing intent.

The backend must validate high-risk outputs before responding:

- If numbers, dates, names, or dictionary terms disappear unexpectedly, return `quality.risk=medium` or `high`.
- If the refined text is empty while raw text is non-empty, return `server.refine_failed`.
- If refinement changes the mode into a command or answer, return `server.refine_failed`.

## 10. UI Requirements

### 10.1 Hub

Home:

- Show the main shortcut and copy: "Press once to start, press again to finish."
- Show current provider status without exposing keys.
- Show recent dictation status and local usage counters.

History:

- Show local retention control at the top.
- Show dictation rows only for this slice.
- Include copied text, insertion status, app name, duration, timestamp, retry, copy, and delete actions.
- Retry is available only for failed or cancelled rows that still have a retained local recording.
- Retrying a retained recording reprocesses the same audio and copies the new refined text to the clipboard instead of automatically inserting into the original app. This avoids duplicate or stale-target insertion.
- Rows without a retained local recording must show retry as unavailable rather than starting a new recording under the same label.

Dictionary:

- Support manual terms.
- Store source as `manual` or `learned`.
- Include search and add flow.
- Advanced fields may be collapsed: aliases, pronunciation hint, capitalization, and language.

Settings:

- Shortcut configuration.
- Microphone selection.
- Provider configuration status.
- Language preference.
- Audio behavior.
- When "Mute other audio" is enabled, the macOS app records the current system output volume/mute state before recording starts, mutes system output while microphone recording is active, and restores the captured state when recording stops, is cancelled, or fails to start. This first slice does not implement per-app audio ducking; a future native helper can replace the system-output fallback.
- Interaction sounds provide lightweight start, completion, and error feedback when enabled, and stay silent when disabled.
- Launch and Dock behavior.
- History retention.

### 10.2 Overlay

Required states:

- `idle`: hidden.
- `recording`: waveform, elapsed time, cancel, finish.
- `finalizing`: recording stopped, upload preparing.
- `processing`: explicit label, activity indicator, provider stage text.
- `inserting`: brief insertion label.
- `complete`: short confirmation.
- `error`: clear message with Retry, Copy, and Dismiss actions.

The overlay must make recording and processing visually distinct. Typeless-like waiting dots are acceptable only with text labels.

## 11. Local Storage

Use SQLite for local app data.

Tables:

- `dictation_history`
- `settings`
- `dictionary_terms`

`dictation_history` fields:

- `id`
- `created_at`
- `updated_at`
- `status`
- `raw_text`
- `refined_text`
- `audio_local_path`
- `duration_ms`
- `language`
- `focused_app_name`
- `focused_app_bundle_id`
- `focused_app_window_title`
- `insertion_method`
- `insertion_status`
- `provider_asr`
- `provider_llm`
- `error_code`
- `timing_json`

Local audio retention follows the same setting as history unless the user disables recording retention.
Changing the history retention setting immediately prunes local history and retained recordings according to the new setting, including deleting all retained rows and audio when retention is set to `never`.

## 12. Permissions and Privacy

Required macOS permissions:

- Microphone.
- Accessibility for reliable insertion and focus/context inspection.

Privacy rules:

- Provider keys live only in `.env` for local development and backend environment variables for deployed environments.
- `.env` must be ignored by git.
- Renderer processes never receive provider keys.
- Audio and transcript content must not be logged by default.
- History is local by default and obeys retention settings.
- Cloud provider processing must be disclosed in the app because this slice uses real providers.

## 13. Error Cases

Client errors:

- `permission.microphone_missing`
- `permission.accessibility_missing`
- `shortcut.conflict`
- `target.no_writable_field`
- `target.focus_changed`
- `audio.device_unavailable`
- `audio.no_speech_detected`
- `insert.failed`
- `network.unavailable`

Server/config errors:

- `config.asr_missing`
- `config.asr_key_missing`
- `config.llm_missing`
- `config.llm_model_missing`
- `config.llm_key_missing`
- `server.asr_failed`
- `server.refine_failed`
- `server.provider_timeout`
- `server.provider_rate_limited`
- `audio.poor_quality`
- `server.audio_too_large`
- `server.unsupported_audio_format`
- `server.invalid_request`

Recovery requirements:

- Permission errors link to the relevant macOS settings.
- Overlay permission errors show a dedicated microphone or Accessibility settings action, not only generic Retry/Copy/Dismiss controls.
- If microphone or Accessibility permission is denied, the recovery action opens the relevant macOS Privacy settings pane instead of only re-reading permission status.
- Provider config errors explain which env var is missing without printing secrets.
- ASR/refinement failures allow retry.
- Error-overlay Retry must reprocess the retained failed recording when local history/recording retention is enabled, instead of starting a new recording under the same failed-session label.
- Insertion failures copy the refined text to clipboard when available.
- If the current target has selected text at insertion time, Echo must avoid direct insertion and use the copy fallback to prevent accidental replacement.
- Direct Accessibility insertion should normalize simple word-boundary spacing around the inserted text, while avoiding extra spaces around punctuation and existing whitespace.
- Automatic clipboard-based paste should treat the clipboard as temporary transport: after a successful paste, Echo restores the user's previous clipboard text. If paste fails, Echo intentionally leaves the refined text on the clipboard and shows the manual paste fallback state.

## 14. Implementation Boundaries

First implementation:

- Electron + TypeScript.
- React renderer for Hub and Overlay.
- Node/TypeScript backend service.
- OpenAI `gpt-4o-transcribe` ASR adapter.
- OpenAI-compatible LLM adapter.
- Full-audio HTTP processing.
- Global shortcut using Electron-supported accelerator first; native `Fn` capture later.
- Audio recording through Electron/browser media APIs first; native helper can replace it if needed.
- Accessibility insertion first where feasible; clipboard paste fallback required.

Later implementation:

- Native macOS keyboard helper for `Fn`.
- Native audio helper for lower-latency Opus/Ogg capture.
- Realtime streaming ASR.
- Hosted backend deployment.
- User-edit learning and automatic dictionary suggestions.

## 15. Verification Plan

Documentation verification:

- `git diff --check`
- Spec self-review for placeholders, contradictions, missing contracts, and scope drift.

Code verification after implementation starts:

- Unit tests for shared schemas, state machine, settings, dictionary, history repository, prompt construction, and result validation.
- Adapter tests that verify OpenAI request construction without using real keys.
- Integration test gated by `RUN_REAL_PROVIDER_TESTS=1` that sends a small local fixture audio file to the real ASR provider and one refinement request to the real LLM provider.
- Desktop build check.
- Manual macOS smoke test:
  1. Start backend and desktop app.
  2. Focus TextEdit.
  3. Trigger dictation shortcut.
  4. Speak a short sentence with a self-correction.
  5. Stop recording.
  6. Confirm overlay processing state.
  7. Confirm refined text insertion.
  8. Confirm History row with provider metadata.
  9. Confirm `.env` and local recordings are not staged by git.

## 16. Acceptance Criteria

This slice is accepted when:

- The desktop app launches on macOS.
- The backend starts with real provider configuration.
- Missing provider configuration produces explicit config errors.
- A user can record a short dictation.
- The recording is sent to OpenAI `gpt-4o-transcribe`.
- The raw transcript is refined by the configured real LLM.
- The refined text is inserted into TextEdit or copied to clipboard if insertion fails.
- The session appears in local History.
- Dictionary terms are included in the backend request.
- Settings expose shortcut, microphone, language, provider status, and retention controls.
- No mock provider is available in production runtime configuration.
- `.env` is ignored and provider keys are never committed.
