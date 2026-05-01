export const DictationErrorCodes = [
  "permission.microphone_missing",
  "permission.accessibility_missing",
  "shortcut.conflict",
  "target.no_writable_field",
  "target.focus_changed",
  "network.unavailable",
  "audio.device_unavailable",
  "audio.no_speech_detected",
  "insert.failed",
  "config.asr_missing",
  "config.llm_missing",
  "server.asr_failed",
  "server.refine_failed",
  "server.provider_timeout",
  "server.provider_rate_limited",
  "server.audio_too_large",
  "server.unsupported_audio_format"
] as const;

export type DictationErrorCode = (typeof DictationErrorCodes)[number];
