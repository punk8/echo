# Mac Dictation Requirements

Status: Draft
Date: 2026-05-02
Scope: macOS-only dictation flow for a Typeless-like voice input product.

## 1. Purpose

This document narrows the product scope to one primary scenario: macOS dictation.

Dictation means the user speaks the content they want to write. The product records the user's speech, converts it to text, cleans and structures the result, then inserts the finished text into the current cursor location.

This document intentionally excludes Ask, selected-text editing, translation mode, web search, mobile apps, team administration, billing, and enterprise controls.

## 2. Reference Evidence

Primary internal references:

- Full product requirements: `docs/requirements/typeless-core-requirements.md`
- Typeless Mac UX teardown: `docs/research/typeless-mac-ux-teardown.md`

Relevant Typeless Mac teardown findings:

- The observed main trigger is toggle-style: press `Fn` once to start recording, press `Fn` again to stop.
- During recording, macOS shows the orange microphone indicator and Typeless shows a bottom black pill overlay.
- After stopping, Typeless processes the dictation and inserts text into the active TextEdit cursor.
- The output is saved in local History.
- Processing state is visible through animation, but not strongly labeled in the observed UI.

## 3. Product Boundary

Included:

- macOS desktop app.
- First-time setup for microphone and text insertion permissions.
- Global dictation trigger.
- Recording overlay.
- Speech recognition.
- AI dictation cleanup and formatting.
- Context-light style adaptation.
- Text insertion at the current cursor.
- Clipboard fallback.
- Local dictation history.
- Dictation settings.
- Personal dictionary for dictation accuracy.

Excluded for now:

- Ask anything.
- Selected text editing.
- Selected text Q&A.
- Translation mode.
- Web search.
- Agentic actions.
- Team management.
- Billing and plan enforcement.
- Mobile apps.
- Enterprise admin and compliance UI.

## 4. Core User Flow

The primary flow is:

1. User focuses a writable text field in any macOS app.
2. User presses the dictation shortcut once.
3. App enters recording state and shows a visible overlay.
4. User speaks naturally.
5. User presses the dictation shortcut again to stop.
6. App enters processing state.
7. System performs ASR and AI dictation cleanup.
8. App inserts the finished text at the original cursor location.
9. App stores the result in local History according to the user's retention setting.

## 5. Interaction Model

### 5.1 Trigger

The default trigger should be toggle-to-record:

- Press once: start dictation.
- Press again: stop dictation and process.

The product copy must use one consistent verb model. If the product uses toggle behavior, the UI should say "Press once to start, press again to finish" rather than "hold to dictate".

Requirements:

- The default shortcut must be visible in Home and Settings.
- The shortcut must be configurable.
- The system must detect shortcut conflicts where possible.
- The user must be able to restore the default shortcut.
- The user must be able to cancel a recording without insertion.

### 5.2 Recording Overlay

The overlay should be a lightweight system-level pill near the bottom of the screen.

Required states:

- Idle: no overlay.
- Recording: waveform or level meter, elapsed time, cancel button, finish button.
- Processing: clear "Processing" or equivalent label, activity indicator, cancel where safe.
- Inserting: brief confirmation that text is being inserted.
- Complete: short success state or quiet dismissal.
- Error: concise message plus retry/copy fallback.

The observed Typeless overlay makes recording visible, but processing is less self-explanatory. Our design should make recording, processing, and insertion visually distinct.

### 5.3 Cancellation

Cancellation must be available while recording.

If the user cancels:

- No text is inserted.
- The app may store a canceled history item only if history is enabled.
- The history row should be clearly marked as canceled.
- The user may retry from the same recording only if the recording was retained locally and the user has consented to local history.

## 6. Dictation Intelligence

Dictation output must not be raw transcription. The product must convert natural speech into clean written text.

### 6.1 Required Cleanup

The dictation processor must:

- Remove filler words and verbal hesitation.
- Remove repeated words, repeated phrases, and duplicate sentences.
- Resolve obvious self-corrections.
- Preserve the user's final intended meaning.
- Add punctuation.
- Add capitalization.
- Add paragraph breaks where appropriate.

Examples:

- Spoken: "Let's meet tomorrow at seven, no actually make that three."
- Output: "Let's meet tomorrow at three."

- Spoken: "Um I think we should maybe, maybe send the update today."
- Output: "I think we should send the update today."

### 6.2 Auto Editing

The processor must detect moments where the user corrects themselves mid-sentence and keep only the final intended content.

Correction cues may include:

- "no"
- "actually"
- "I mean"
- "change that to"
- "make it"
- "sorry"
- "rather"
- Chinese equivalents such as "不对", "改成", "应该是", "我是说"

The processor should avoid keeping both the original and corrected versions unless the user clearly intends to mention both.

### 6.3 Auto Formatting

The processor must structure dictated content when the speech implies structure.

Supported structures:

- Bulleted lists.
- Numbered lists.
- Steps.
- Short paragraphs.
- Headings when explicitly requested as part of the content.
- Simple task lists.

Examples:

- Spoken: "Shopping list, bananas, oat milk, dark chocolate."
- Output:
  - Bananas
  - Oat milk
  - Dark chocolate

- Spoken: "There are three steps. First install the app. Second allow microphone access. Third try a short dictation."
- Output:
  1. Install the app.
  2. Allow microphone access.
  3. Try a short dictation.

### 6.4 Word Choice and Clarity

The processor should improve clarity without changing the user's meaning.

Allowed transformations:

- Replace awkward oral phrasing with clearer written phrasing.
- Smooth sentence boundaries.
- Make the text easier to read.
- Choose precise words when the user's intent is clear.

Disallowed transformations:

- Add facts not present in the user's speech.
- Change the user's intent.
- Turn ordinary dictation into a task execution unless the product has explicit command mode enabled.
- Over-polish casual chat into formal writing unless the active context or user preference calls for it.

### 6.5 Literal vs Polished Balance

The default should be polished dictation, not literal transcription.

The product should still preserve:

- Names.
- Numbers.
- Dates.
- Product names.
- Technical terms.
- User dictionary entries.
- Intentional repetition when it is clearly meaningful.

## 7. Context Handling

For the dictation-only scope, context should be limited.

Required context:

- Active app name.
- Whether there is a writable focused text field.
- Current insertion target availability.
- Current selection state only to avoid accidental replacement.

Optional context:

- Nearby text around cursor, if safely available.
- App category, such as chat, email, note, document, IDE, or browser.

Context must be used only to choose style and insertion behavior. It must not trigger summarization, translation, command execution, or any other non-dictation mode in this document's scope.

## 8. Text Insertion

### 8.1 Primary Insertion

The product must insert the final processed text at the current cursor location.

Requirements:

- Preserve expected spacing before and after inserted text.
- Avoid duplicate insertion after retries.
- Handle focus changes safely.
- Allow host-app undo where possible.

### 8.2 Fallback Insertion

If direct insertion fails, the product must:

- Copy the result to the clipboard.
- Show a clear fallback message.
- Offer a manual paste instruction.
- Preserve the generated text in local History if enabled.

### 8.3 Focus Safety

The product should remember the target app and focused element at recording start.

If focus changes before insertion:

- If the target is still valid, insert into the original target.
- If the target is no longer valid, do not blindly insert into the new app.
- Show a fallback with copy-to-clipboard.

## 9. History

The product must provide local dictation history.

Requirements:

- Store successful dictation outputs locally when enabled.
- Store enough metadata for troubleshooting: timestamp, active app, duration, insertion status, and output length.
- Allow retention settings: never, 24 hours, 1 week, 1 month, forever.
- Allow deleting individual entries.
- Allow clearing all history.
- Allow copying a previous result.
- Clearly explain local history retention separately from cloud processing retention.

History should not include unrelated Ask, edit, or translation filters in this dictation-only scope.

## 10. Dictionary

The product should include a personal dictionary because dictation quality depends on stable recognition of names and domain terms.

Required fields:

- Term.
- Optional aliases.
- Optional pronunciation hint.
- Optional capitalization preference.
- Optional language.

Requirements:

- Add, edit, delete, and search entries.
- Mark whether an entry was manually added or suggested automatically.
- Apply dictionary entries during ASR and post-processing.
- Preserve dictionary terms during cleanup and formatting.

## 11. Settings

Required settings:

- Dictation shortcut.
- Microphone device.
- Interaction sounds.
- Mute other audio while dictating.
- Launch at login.
- Show in Dock.
- History retention.
- Default output style: more literal, balanced, or more polished.

Settings for Ask, translation, selected-text editing, teams, and billing should not appear in the initial dictation-only product surface.

## 12. Error Handling

The product must handle:

- Microphone permission missing.
- Accessibility or text insertion permission missing.
- No writable text target.
- Shortcut conflict.
- No speech detected.
- Poor audio quality.
- Network failure.
- ASR failure.
- AI cleanup failure.
- Insertion failure.
- User changes focus during processing.

For every error, the product must provide:

- A short user-facing explanation.
- A recovery action.
- A copy-to-clipboard fallback when generated text exists.

## 13. Privacy Requirements

The product must explain:

- What audio is captured.
- Whether audio is sent to a server.
- Whether audio is retained.
- Whether transcript or final output is retained.
- Whether local history is enabled.
- Whether dictation data is used for model training.

Default privacy posture:

- Do not use user dictations for model training without explicit opt-in.
- Keep local history local unless sync is explicitly introduced later.
- Do not collect full screen or full document context for dictation.
- Do not log sensitive content by default.

## 14. Non-Functional Requirements

### 14.1 Latency

The product should optimize for time from second shortcut press to inserted text.

Targets to define during implementation planning:

- Start recording latency.
- Stop-to-processing latency.
- Stop-to-insert latency.
- Long dictation segmentation behavior.

### 14.2 Quality

Quality must be evaluated by final usable text, not raw transcription alone.

Test dimensions:

- Filler removal.
- Repetition removal.
- Self-correction handling.
- Punctuation.
- Paragraphing.
- List formatting.
- Chinese.
- English.
- Mixed Chinese-English.
- Names and technical terms.
- Casual chat style.
- Professional email style.

### 14.3 Compatibility

The first target apps should include:

- TextEdit.
- Notes.
- Safari or Chrome text fields.
- Slack-like chat input.
- Gmail or Mail compose field.
- Cursor or another code/editor input surface.

Each app should be tested for:

- Recording trigger.
- Focus retention.
- Insertion success.
- Undo behavior.
- Clipboard fallback.

## 15. Out of Scope

The following must not be included in the dictation-only spec:

- Ask anything.
- Summarizing selected text.
- Editing selected text by voice.
- Translating dictated speech into another language.
- Searching the web.
- Opening URLs or taking actions.
- Team member management.
- Subscription enforcement.
- Enterprise security dashboards.
- Mobile app behavior.

## 16. Open Decisions

- Whether default shortcut should be `Fn` or a safer configurable combination.
- Whether to support hold-to-talk in addition to toggle-to-record.
- Whether to show generated text preview before insertion or insert automatically.
- Whether local audio recordings should be retained, and for how long.
- Whether cleanup should run in one model pass after ASR or as a streaming post-processing pipeline.
- Whether context style should be automatic only or user-configurable per app.
