import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import {
  DictationContextSchema,
  DictationPreferencesSchema,
  DictionaryTermSchema,
  type DictationContext,
  type DictationPreferences,
  type DictionaryTerm
} from "@echo/shared";
import type { ASRProvider } from "../providers/asr/ASRProvider.js";
import type { LLMProvider } from "../providers/llm/LLMProvider.js";
import { buildDictationPrompt } from "../refiner/buildDictationPrompt.js";
import { validateRefinedResult } from "../refiner/validateRefinedResult.js";

export interface DictationRouteDeps {
  asr: ASRProvider;
  llm: LLMProvider;
  maxAudioBytes?: number;
}

interface ParsedMultipart {
  sessionId: string;
  audioFormat: "webm" | "wav";
  durationMs: number;
  language: string;
  context: DictationContext;
  dictionary: DictionaryTerm[];
  preferences: DictationPreferences;
  audio: Buffer;
  filename: string;
  mimeType: "audio/webm" | "audio/wav";
}

export async function registerDictationRoute(app: FastifyInstance, deps: DictationRouteDeps) {
  app.post("/v1/dictation/process", async (request, reply) => {
    const receivedAt = new Date();
    let sessionId = "";
    let recoverableRawText = "";

    try {
      const parsed = await parseMultipart(request, deps.maxAudioBytes ?? defaultMaxAudioBytes);
      sessionId = parsed.sessionId;
      const asrPrompt = buildDictionaryPrompt(parsed.dictionary);
      const asrInput = {
        audio: parsed.audio,
        filename: parsed.filename,
        mimeType: parsed.mimeType,
        language: parsed.language
      };
      const asrResult = await deps.asr.transcribe(asrPrompt ? { ...asrInput, prompt: asrPrompt } : asrInput);
      recoverableRawText = asrResult.rawText;
      if (asrResult.rawText.trim().length === 0) {
        throw new Error("audio.no_speech_detected");
      }

      const prompt = buildDictationPrompt({
        rawText: asrResult.rawText,
        language: asrResult.language,
        context: parsed.context,
        dictionary: parsed.dictionary,
        preferences: parsed.preferences
      });

      const llmResult = await deps.llm.complete({
        messages: [
          { role: "system", content: prompt.system },
          { role: "user", content: prompt.user }
        ],
        temperature: 0.2,
        responseFormat: "json_object"
      });

      const refined = validateRefinedResult({
        rawText: asrResult.rawText,
        llmContent: llmResult.content,
        dictionaryTerms: parsed.dictionary.map((term) => term.term)
      });

      const asrMs = asrResult.durationMs ?? 0;
      const refineMs = llmResult.durationMs ?? 0;

      return reply.send({
        session_id: parsed.sessionId,
        raw_text: asrResult.rawText,
        refined_text: refined.refinedText,
        language: refined.language,
        provider: {
          asr: asrResult.provider,
          llm: llmResult.provider
        },
        timing: {
          upload_received_at: receivedAt.toISOString(),
          asr_ms: asrMs,
          refine_ms: refineMs,
          total_ms: asrMs + refineMs
        },
        quality: {
          risk: refined.risk,
          warnings: refined.warnings
        }
      });
    } catch (error) {
      return sendError(reply, { sessionId, rawText: recoverableRawText }, error);
    }
  });
}

const defaultMaxAudioBytes = 25 * 1024 * 1024;

async function parseMultipart(request: FastifyRequest, maxAudioBytes: number): Promise<ParsedMultipart> {
  const fields = new Map<string, string>();
  let audio: Buffer | undefined;
  let filename = "dictation.webm";
  let mimeType: "audio/webm" | "audio/wav" = "audio/webm";

  for await (const part of request.parts()) {
    if (part.type === "file") {
      if (part.fieldname !== "audio") {
        continue;
      }
      audio = await part.toBuffer();
      filename = part.filename;
      mimeType = normalizeMimeType(part.mimetype);
      continue;
    }

    fields.set(part.fieldname, String(part.value));
  }

  if (!audio) {
    throw new Error("server.audio_missing");
  }
  if (audio.byteLength > maxAudioBytes) {
    throw new Error("server.audio_too_large");
  }

  const audioFormat = parseAudioFormat(required(fields, "audio_format"));
  const expectedMimeType = audioFormat === "webm" ? "audio/webm" : "audio/wav";
  if (mimeType !== expectedMimeType) {
    throw new Error("server.unsupported_audio_format");
  }

  return {
    sessionId: required(fields, "session_id"),
    audioFormat,
    durationMs: parseDurationMs(required(fields, "duration_ms")),
    language: required(fields, "language"),
    context: DictationContextSchema.parse(JSON.parse(required(fields, "context"))),
    dictionary: DictionaryTermSchema.array().parse(JSON.parse(required(fields, "dictionary"))),
    preferences: DictationPreferencesSchema.parse(JSON.parse(required(fields, "preferences"))),
    audio,
    filename,
    mimeType
  };
}

function buildDictionaryPrompt(dictionary: DictionaryTerm[]) {
  if (dictionary.length === 0) {
    return undefined;
  }

  return `User dictionary: ${dictionary.map((term) => term.term).join(", ")}`;
}

function required(fields: Map<string, string>, key: string) {
  const value = fields.get(key);
  if (!value) {
    throw new Error(`missing.${key}`);
  }
  return value;
}

function parseAudioFormat(value: string): "webm" | "wav" {
  if (value === "webm" || value === "wav") {
    return value;
  }
  throw new Error("server.unsupported_audio_format");
}

function parseDurationMs(value: string) {
  const durationMs = Number(value);
  if (!Number.isInteger(durationMs) || durationMs < 0) {
    throw new Error("server.invalid_duration");
  }
  return durationMs;
}

function normalizeMimeType(value: string): "audio/webm" | "audio/wav" {
  if (value === "audio/webm") {
    return "audio/webm";
  }
  if (value === "audio/wav" || value === "audio/wave" || value === "audio/x-wav") {
    return "audio/wav";
  }
  throw new Error("server.unsupported_audio_format");
}

function sendError(reply: FastifyReply, recovery: { sessionId: string; rawText: string }, error: unknown) {
  const code = error instanceof Error ? error.message : "server.refine_failed";

  return reply.status(statusForError(code)).send({
    session_id: recovery.sessionId,
    error: {
      code,
      message: messageForCode(code),
      recoverable: true
    },
    raw_text: recovery.rawText
  });
}

function statusForError(code: string) {
  if (code.startsWith("missing.") || code === "server.unsupported_audio_format" || code === "server.invalid_duration") {
    return 400;
  }
  if (code === "audio.no_speech_detected") {
    return 422;
  }
  if (code === "server.provider_rate_limited") {
    return 429;
  }
  if (code === "server.audio_too_large") {
    return 413;
  }
  if (code === "server.provider_timeout") {
    return 504;
  }
  return 500;
}

function messageForCode(code: string) {
  if (code === "server.asr_failed") {
    return "Speech recognition failed.";
  }
  if (code === "server.refine_failed") {
    return "Dictation refinement failed.";
  }
  if (code === "server.unsupported_audio_format") {
    return "Unsupported audio format.";
  }
  if (code === "audio.no_speech_detected") {
    return "No speech was detected. Try again closer to the microphone.";
  }
  if (code === "server.provider_rate_limited") {
    return "Provider rate limit reached. Try again shortly.";
  }
  if (code === "server.provider_timeout") {
    return "Provider request timed out. Try again.";
  }
  if (code === "server.audio_too_large") {
    return "Recording is too large. Try a shorter dictation.";
  }
  if (code === "server.invalid_duration") {
    return "Invalid recording duration.";
  }
  return "Dictation processing failed.";
}
