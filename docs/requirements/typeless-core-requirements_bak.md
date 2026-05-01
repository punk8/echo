# Typeless-like AI Voice Input Product Requirements

Status: Draft
Date: 2026-05-02
Scope: Full product requirements for a commercial AI voice input product comparable to Typeless.

## 1. Purpose

This document defines the core requirements for an AI voice input product that matches the main functional surface of Typeless: users speak naturally, and the product converts speech into polished, context-aware text inside the apps where they already work.

The product should be evaluated as a complete commercial product, not as an MVP. Development planning can later split these requirements into phases, but this spec describes the target finished experience.

## 2. Source Baseline

The requirements are based on Typeless public product information and the prior product research in this project.

Primary public sources:

- Typeless homepage: https://www.typeless.com/
- Typeless pricing: https://www.typeless.com/pricing
- Typeless data controls: https://www.typeless.com/data-controls
- Typeless privacy policy: https://www.typeless.com/privacy
- Typeless trust center: https://trust.typeless.com/

This spec separates Typeless-supported capabilities from target-product requirements. Typeless-supported capabilities describe what the reference product publicly presents. Target-product requirements describe what our comparable finished product should support.

## 3. Typeless Core Capability Map

| Capability | Typeless public support | Requirement interpretation |
| --- | --- | --- |
| System-wide AI dictation | Homepage positions Typeless as voice dictation that works inside existing tools and across devices. | Users must be able to speak in arbitrary writing surfaces and receive polished inserted text. |
| Voice-to-perfect-text | Pricing lists "Voice-to-perfect-text"; homepage describes turning raw speech into clear emails, messages, and docs. | The product must clean, format, and rewrite spoken input into ready-to-use written output. |
| Filler-word and repetition cleanup | Homepage describes removing verbal noise and duplicate phrases. | The text engine must remove filler words, repeated phrases, false starts, and obvious self-corrections. |
| Context-aware output | Data controls describe processing voice audio with limited context such as current app and relevant text. | The product must adapt tone and formatting based on active app and selected or nearby text. |
| Personalized writing style and tone | Pricing and homepage list personalized writing style and tone. | The product must learn or configure user-level writing preferences and apply them consistently. |
| Personal dictionary | Pricing and homepage list personal dictionary. | The product must support custom vocabulary, names, acronyms, technical terms, and preferred spellings. |
| 100+ languages | Pricing and homepage list support for 100+ languages. | The product must support multilingual dictation, mixed-language speech, and language detection. |
| Per-app tones | Pricing and homepage list different tones for each app. | The product must allow app-specific style rules, such as formal email and casual chat. |
| Translation | Pricing and homepage list Translate; homepage describes translating as the user speaks. | The product must translate dictated speech and selected text into natural target-language writing. |
| Ask anything | Pricing and homepage list Ask anything. Homepage describes editing selected text, asking about selected text, quick answers, search, and page opening. | The product must support voice-driven edit, ask, summarize, explain, translate, search, and bounded action flows. |
| Whisper mode | Pricing lists Whisper mode. | The product should support quiet speech capture where technically feasible. |
| Cross-platform use | Pricing lists macOS, Windows, iOS, and Android. | The finished product must support desktop and mobile experiences with shared account state. |
| Team management | Pricing lists team member management for paid plans. | The product must support multi-seat teams, centralized billing, and administrative controls. |
| Privacy controls | Data controls and privacy pages describe zero cloud data retention for dictation data, no training, limited contextual processing, and local history. | The product must define and enforce explicit data retention, training, context, and history policies. |

## 4. Product Definition

The product is a system-wide AI voice input layer for desktop and mobile. It lets users dictate, edit, translate, and ask questions by voice across existing applications.

The product is not a simple transcription tool. The expected output is ready-to-use written text: cleaned, formatted, adapted to the active application, and shaped to the user's writing style.

## 5. Target Users

The product must support high-frequency text producers, including:

- Knowledge workers writing emails, messages, documents, notes, tasks, and AI prompts.
- Developers and technical workers writing prompts, issues, code comments, tickets, pull request notes, and documentation.
- Operators and managers working across Slack, Gmail, Notion, Google Docs, Jira, Linear, GitHub, Cursor, ChatGPT, Claude, and similar tools.
- Students and researchers capturing notes, summaries, drafts, and translations.
- Teams or companies that need admin, billing, and data control around voice input.

## 6. Supported Platforms

The finished product must support:

- macOS desktop app.
- Windows desktop app.
- iOS mobile app or keyboard-level input experience.
- Android mobile app or keyboard-level input experience.
- Shared account and subscription state across supported devices.

Desktop apps must work in arbitrary text fields across native apps, browsers, Electron apps, IDEs, and productivity tools. Mobile apps must provide voice input in common mobile writing contexts, preferably through keyboard-level integration where platform rules allow it.

## 7. Core User Journeys

### 7.1 First-Time Setup

1. User installs the app and signs in.
2. User receives a Pro trial or lands on a plan with a clear usage allowance.
3. App guides the user through required permissions:
   - Microphone access.
   - Accessibility or input permissions for desktop text insertion.
   - Keyboard/input extension permissions on mobile, if applicable.
4. User configures a trigger method, such as a global shortcut or push-to-talk key.
5. User completes a short test dictation and sees text inserted into the active app.

Acceptance criteria:

- The user can complete setup without reading external documentation.
- Permission failures are explained with exact recovery steps.
- The product verifies that voice capture and text insertion both work before ending onboarding.

### 7.2 Dictate Into Any App

1. User focuses a text field in any supported app.
2. User triggers voice input.
3. User speaks naturally, including pauses, filler words, corrections, and formatting intent.
4. Product returns clean text and inserts it at the cursor.

Acceptance criteria:

- Output removes filler words, duplicate phrases, and obvious false starts.
- Output preserves intended meaning rather than literal raw transcript.
- Output includes punctuation and paragraph structure.
- Output can generate bullets, numbered lists, steps, and short paragraphs when implied by speech.
- If insertion fails, the app provides copy-to-clipboard fallback.

### 7.3 Context-Aware Writing

1. User dictates inside a specific app or writing context.
2. Product detects the current application and limited surrounding context.
3. Product adapts tone, structure, and format to the context.

Examples:

- Email: clear, complete, professional prose.
- Slack or chat: concise and conversational.
- Google Docs or Notion: structured paragraphs, bullets, and headings where useful.
- Cursor or GitHub: technical terminology preserved; code-adjacent text is concise and precise.
- ChatGPT or Claude: prompt wording is structured and explicit.

Acceptance criteria:

- The same spoken input may produce different output styles in different apps.
- The user can override app-specific tone or formatting.
- The product never sends more context than needed for the current operation.

### 7.4 Speak to Edit Selected Text

1. User selects text in any readable or editable surface.
2. User triggers voice command mode.
3. User says an instruction such as "make this shorter", "make it more polite", "turn it into bullets", or "write a reply".
4. Product transforms the selected text.

Acceptance criteria:

- Product distinguishes dictation from editing instructions.
- Product can shorten, expand, rephrase, change tone, fix grammar, translate, summarize, and generate replies.
- In editable fields, transformed text can replace the selection.
- In read-only surfaces, transformed output is shown in an overlay or copied to clipboard rather than attempting replacement.

### 7.5 Ask About Selected Text

1. User selects text on a webpage, document, email, or message thread.
2. User asks a spoken question about that text.
3. Product returns an answer, explanation, summary, or translation.

Acceptance criteria:

- Product can summarize, explain, translate, and extract action items from selected text.
- Product clearly separates the source text from generated answer text.
- Product does not modify the original text unless the user explicitly requests an edit.

### 7.6 Translate While Speaking

1. User chooses a target language.
2. User speaks in one language or mixes languages.
3. Product outputs polished text in the target language.

Acceptance criteria:

- Product supports 100+ languages as a target capability.
- Product handles mixed-language speech.
- Translation should read naturally in the target language, not as literal word-by-word translation.
- User can choose whether to preserve proper nouns, technical terms, and product names.

### 7.7 Personal Dictionary

1. User adds names, companies, acronyms, technical terms, project names, and preferred spellings.
2. Product uses the dictionary during dictation and editing.
3. Product may suggest dictionary additions based on repeated corrections.

Acceptance criteria:

- User can add, edit, delete, import, and export dictionary entries.
- Dictionary entries can include pronunciation hints, aliases, and capitalization.
- Dictionary data is applied across apps and devices where sync is enabled.
- Teams can define shared dictionary entries for company terminology.

### 7.8 Personalized Writing Style

1. Product learns the user's preferred tone, phrasing, and formatting over time.
2. User can review, adjust, reset, or disable personalization.
3. Product applies personalization to dictation and editing.

Acceptance criteria:

- Personalization improves output without making the user manually configure prompts for every use.
- User can set defaults such as concise, formal, casual, detailed, direct, or friendly.
- App-specific style settings override global defaults.
- Product explains what personalization data is stored and where it is stored.

### 7.9 Quick Answers and Actions

1. User asks a spoken request unrelated to direct dictation, such as looking up current information, brainstorming, or opening a relevant page.
2. Product interprets the request and either answers or performs a bounded action.

Acceptance criteria:

- Product can answer simple questions in an overlay.
- Product can use web search or connected services only when the user has enabled the capability.
- Product can open a relevant URL or prefill a page when the action is unambiguous.
- Product must ask for confirmation before destructive, external, or irreversible actions.

## 8. Functional Requirements

### 8.1 Account, Plans, and Billing

REQ-001: The product must support account creation, sign-in, sign-out, and account deletion.

REQ-002: The product must support a free plan or free trial with explicit usage limits.

REQ-003: The product must support paid subscriptions with unlimited or materially higher usage limits.

REQ-004: The product must support multi-seat paid accounts for teams.

REQ-005: The product must track usage in words or equivalent billable units.

REQ-006: The product must show remaining free usage before the user hits the limit.

REQ-007: The product must support subscription management, cancellation, and billing history.

REQ-008: The product must support platform payment providers where applicable, such as Stripe, Apple, and Google.

### 8.2 Onboarding and Permissions

REQ-009: The product must guide users through microphone permission setup.

REQ-010: Desktop apps must guide users through accessibility/input permissions required for text insertion.

REQ-011: Mobile apps must guide users through keyboard/input extension permissions if used.

REQ-012: The product must verify that recording and text insertion work during onboarding.

REQ-013: The product must provide clear recovery instructions when permissions are missing, denied, or revoked.

### 8.3 Voice Capture

REQ-014: The product must support global voice activation on desktop.

REQ-015: The product must support configurable shortcuts or push-to-talk behavior.

REQ-016: The product must display clear recording state, processing state, success state, and failure state.

REQ-017: The product must support canceling an in-progress dictation before insertion.

REQ-018: The product must handle pauses, restarts, and mid-sentence corrections.

REQ-019: The product should support quiet or whisper-style speech where technically feasible.

### 8.4 Speech Recognition

REQ-020: The product must convert speech to text with low enough latency to preserve the user's writing flow.

REQ-021: The product must support automatic language detection.

REQ-022: The product must support mixed-language speech.

REQ-023: The product must support specialized vocabulary through personal and team dictionaries.

REQ-024: The product must degrade gracefully when audio quality is poor, the network is slow, or model providers fail.

REQ-025: The product must expose retry, edit, and copy options when output quality is poor.

### 8.5 AI Text Cleanup and Formatting

REQ-026: The product must remove filler words and repeated phrases.

REQ-027: The product must detect and resolve obvious verbal corrections, such as "actually", "no", or "change that to".

REQ-028: The product must add punctuation, capitalization, and paragraph breaks.

REQ-029: The product must infer common structures including bullet lists, numbered steps, headings, short paragraphs, and task lists.

REQ-030: The product must preserve semantic intent and avoid adding unsupported facts.

REQ-031: The product must allow users to choose between more literal transcription and more polished rewriting.

### 8.6 App Context Awareness

REQ-032: The product must identify the active application on desktop.

REQ-033: The product must use limited context such as active app, selected text, and nearby text where permissions and platform APIs allow.

REQ-034: The product must adapt output style based on application category.

REQ-035: The product must let users configure app-specific tone and formatting.

REQ-036: The product must avoid collecting full-screen or full-document context unless explicitly enabled for a feature.

REQ-037: The product must provide a visible privacy explanation for what context is used.

### 8.7 Text Insertion and Replacement

REQ-038: The product must insert generated text at the current cursor location on desktop.

REQ-039: The product must replace selected text when the user requests an edit in an editable field.

REQ-040: The product must provide clipboard fallback when direct insertion is not available.

REQ-041: The product must preserve expected spacing around inserted or replaced text.

REQ-042: The product must avoid duplicate insertion after retries or focus changes.

REQ-043: The product must support undo through the host application where possible.

### 8.8 Voice Editing Commands

REQ-044: The product must support voice commands for shortening, expanding, rephrasing, changing tone, correcting grammar, translating, summarizing, and generating replies.

REQ-045: The product must recognize whether speech is dictation content or an instruction.

REQ-046: The product must provide a way to preview transformed output before replacement for high-risk edits.

REQ-047: The product must support command history or quick repeat for common transformations.

### 8.9 Ask About Text

REQ-048: The product must support question answering over selected text.

REQ-049: The product must support summaries, explanations, translations, and action-item extraction.

REQ-050: The product must show answer output without modifying source text by default.

REQ-051: The product must limit source text length or summarize locally before sending if required for privacy, latency, or token limits.

### 8.10 Translation

REQ-052: The product must support translating dictated speech to a chosen target language.

REQ-053: The product must support translating selected text.

REQ-054: The product must preserve names, domain terms, and user dictionary entries during translation.

REQ-055: The product must allow users to switch between automatic source-language detection and manually selected source language.

### 8.11 Personalization

REQ-056: The product must support a personal dictionary.

REQ-057: The product must support personalized writing style and tone.

REQ-058: The product must support app-specific style preferences.

REQ-059: The product must allow users to inspect, edit, disable, or reset personalization.

REQ-060: The product must not use personalization data for model training unless the user explicitly opts in.

### 8.12 History and Local Controls

REQ-061: The product must provide local dictation history or recent output history.

REQ-062: The user must be able to delete history.

REQ-063: The product must clearly state whether history is local-only, synced, or stored server-side.

REQ-064: The product must support disabling history.

REQ-065: The product must allow copying, reusing, or re-running a previous output.

### 8.13 Team and Enterprise Administration

REQ-066: The product must support team member invitations and removals.

REQ-067: The product must support role-based access for admins and members.

REQ-068: The product must support centralized billing for teams.

REQ-069: The product must support team dictionaries and shared terminology.

REQ-070: The product should support SSO and SCIM for enterprise customers.

REQ-071: The product should support admin controls for data retention, feedback sharing, third-party model usage, and allowed integrations.

REQ-072: The product should support audit logs for administrative events.

### 8.14 Privacy, Security, and Compliance

REQ-073: The product must define a clear data retention policy for audio, transcripts, selected text, context, history, account data, billing data, and diagnostics.

REQ-074: The product must not train models on customer dictation data without explicit opt-in.

REQ-075: The product must encrypt data in transit.

REQ-076: The product must encrypt stored sensitive data at rest.

REQ-077: The product must document third-party processors and model providers.

REQ-078: The product must support deletion requests for account and personal data.

REQ-079: The product must support enterprise DPA and subprocessors documentation.

REQ-080: The product must not claim certifications such as SOC 2, HIPAA, ISO 27001, or GDPR compliance unless the legal and audit basis is complete.

### 8.15 Reliability and Observability

REQ-081: The product must monitor successful dictations, failed dictations, latency, insertion failures, ASR errors, and model provider failures.

REQ-082: The product must expose user-safe error messages when dictation fails.

REQ-083: The product must retry transient failures without causing duplicate text insertion.

REQ-084: The product must provide a public or customer-facing service status channel for major outages.

REQ-085: The product must support diagnostic feedback submission with explicit user consent before attaching dictation content.

## 9. Non-Functional Requirements

### 9.1 Latency

- The product should feel close to real-time for short dictations.
- Longer dictations may process in segments, but the user should always see clear progress.
- The system should optimize for time from speech end to inserted text.

### 9.2 Accuracy

- The product must optimize for final usable text quality, not only raw word error rate.
- Accuracy must be evaluated across accents, noisy environments, fast speech, whisper speech, mixed-language speech, and domain vocabulary.

### 9.3 Compatibility

- Desktop insertion must work across native apps, browsers, Electron apps, IDEs, and common enterprise tools.
- Compatibility failures must have fallback behavior.
- The product must handle focus changes while recording or inserting.

### 9.4 Privacy by Design

- The product must minimize context collection.
- Sensitive content must not be logged by default.
- Feedback flows must separate diagnostic metadata from optional user-provided content.

### 9.5 Cost Control

- The product must track ASR, LLM, translation, search, and storage cost drivers.
- Free plan limits must be enforceable in real time.
- Abuse prevention must protect high-cost voice and model endpoints.

## 10. Product Modes

The product should expose clear modes, even if the UI presents them naturally:

- Dictation mode: speak content and insert polished text.
- Edit mode: speak an instruction for selected text.
- Ask mode: ask about selected or visible text.
- Translate mode: produce output in a target language.
- Command/action mode: perform bounded actions such as search or open a relevant page.

The user should not have to manually switch modes in simple cases, but the product must make mode detection understandable and correctable.

## 11. Product Boundaries

The product should not be positioned as:

- A full autonomous agent that can operate arbitrary applications without confirmation.
- A general meeting recorder or long-form transcript archive, unless added as a separate product surface.
- A replacement for human review in legal, medical, financial, hiring, or other high-stakes decisions.
- A tool that silently captures all screen or document content.

## 12. Key Risks

- Latency risk: cloud ASR plus LLM post-processing can feel slow if the pipeline is not optimized.
- Trust risk: users may reject the product if it appears to capture too much context.
- Compatibility risk: arbitrary app insertion is fragile across OS versions and app frameworks.
- Cost risk: unlimited paid plans can become unprofitable for heavy users without usage management.
- Quality risk: literal transcription quality is not enough; the product must produce text users would actually send.
- Compliance risk: enterprise claims require legal, security, and operational maturity.

## 13. Open Product Decisions

These decisions are intentionally left for a later product strategy document:

- Whether to differentiate primarily through Chinese and mixed Chinese-English support, developer workflows, privacy-first local processing, or vertical industry templates.
- Whether to store dictation history local-only or sync it across devices.
- Whether to offer local ASR or BYOK model provider support.
- Whether to build mobile keyboard integrations immediately or after desktop parity.
- Whether team administration is self-serve from launch or sales-led enterprise only.
