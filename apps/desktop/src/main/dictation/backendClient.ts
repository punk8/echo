import {
  DictationErrorResponseSchema,
  DictationSuccessResponseSchema,
  type AudioFormat,
  type DictationContext,
  type DictationPreferences,
  type DictationSuccessResponse,
  type DictionaryTerm
} from "@echo/shared";

export interface ProcessDictationInput {
  apiBaseUrl: string;
  fetchImpl?: FetchLike;
  sessionId: string;
  audio: Buffer;
  audioFormat: AudioFormat;
  durationMs: number;
  language: string;
  context: DictationContext;
  dictionary: DictionaryTerm[];
  preferences: DictationPreferences;
}

export type FetchLike = (
  input: string,
  init: RequestInit
) => Promise<{
  ok: boolean;
  json: () => Promise<unknown>;
}>;

export interface BackendDictationErrorInput {
  code: string;
  message: string;
  recoverable: boolean;
  rawText: string;
}

export class BackendDictationError extends Error {
  readonly code: string;
  readonly recoverable: boolean;
  readonly rawText: string;

  constructor(input: BackendDictationErrorInput) {
    super(input.message);
    this.name = "BackendDictationError";
    this.code = input.code;
    this.recoverable = input.recoverable;
    this.rawText = input.rawText;
  }
}

export async function processDictation(input: ProcessDictationInput): Promise<DictationSuccessResponse> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const body = new FormData();
  const mimeType = input.audioFormat === "webm" ? "audio/webm" : "audio/wav";
  const filename = `dictation-${input.sessionId}.${input.audioFormat}`;

  body.set("session_id", input.sessionId);
  body.set("audio_format", input.audioFormat);
  body.set("duration_ms", String(input.durationMs));
  body.set("language", input.language);
  body.set("context", JSON.stringify(input.context));
  body.set("dictionary", JSON.stringify(input.dictionary));
  body.set("preferences", JSON.stringify(input.preferences));
  body.set("audio", new Blob([toArrayBuffer(input.audio)], { type: mimeType }), filename);

  const response = await fetchImpl(`${trimTrailingSlash(input.apiBaseUrl)}/v1/dictation/process`, {
    method: "POST",
    body
  });

  const payload = await response.json();

  if (!response.ok) {
    const parsed = DictationErrorResponseSchema.parse(payload);
    throw new BackendDictationError({
      code: parsed.error.code,
      message: parsed.error.message,
      recoverable: parsed.error.recoverable,
      rawText: parsed.raw_text
    });
  }

  return DictationSuccessResponseSchema.parse(payload);
}

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

function toArrayBuffer(buffer: Buffer): ArrayBuffer {
  const arrayBuffer = new ArrayBuffer(buffer.byteLength);
  new Uint8Array(arrayBuffer).set(buffer);
  return arrayBuffer;
}
