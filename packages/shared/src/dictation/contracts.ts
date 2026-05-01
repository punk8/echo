import { z } from "zod";

export const AudioFormatSchema = z.enum(["webm", "wav"]);
export const DictationStyleSchema = z.enum(["literal", "balanced", "polished"]);
export const OutputLanguageSchema = z.enum(["follow_input", "zh", "en"]);
export const QualityRiskSchema = z.enum(["low", "medium", "high"]);

export const DictationContextSchema = z.object({
  app_name: z.string().min(1),
  bundle_id: z.string().min(1),
  window_title: z.string(),
  writable: z.boolean(),
  selection_present: z.boolean(),
  nearby_text: z.string()
});

export const DictionaryTermSchema = z.object({
  term: z.string().min(1),
  aliases: z.array(z.string()),
  case_sensitive: z.boolean(),
  source: z.enum(["manual", "learned"]),
  pronunciation_hint: z.string().optional(),
  capitalization: z.string().optional()
});

export const DictationPreferencesSchema = z.object({
  style: DictationStyleSchema,
  output_language: OutputLanguageSchema,
  format_lists: z.boolean()
});

export const DictationProcessRequestSchema = z.object({
  session_id: z.string().min(1),
  audio_format: AudioFormatSchema,
  duration_ms: z.number().int().nonnegative(),
  language: z.string().min(1),
  context: DictationContextSchema,
  dictionary: z.array(DictionaryTermSchema),
  preferences: DictationPreferencesSchema
});

export const DictationSuccessResponseSchema = z.object({
  session_id: z.string().min(1),
  raw_text: z.string(),
  refined_text: z.string(),
  language: z.string().min(1),
  provider: z.object({
    asr: z.string().min(1),
    llm: z.string().min(1)
  }),
  timing: z.object({
    upload_received_at: z.string().datetime(),
    asr_ms: z.number().nonnegative(),
    refine_ms: z.number().nonnegative(),
    total_ms: z.number().nonnegative()
  }),
  quality: z.object({
    risk: QualityRiskSchema,
    warnings: z.array(z.string())
  })
});

export const DictationErrorResponseSchema = z.object({
  session_id: z.string().min(1),
  error: z.object({
    code: z.string().min(1),
    message: z.string().min(1),
    recoverable: z.boolean()
  }),
  raw_text: z.string()
});

export type AudioFormat = z.infer<typeof AudioFormatSchema>;
export type DictationStyle = z.infer<typeof DictationStyleSchema>;
export type OutputLanguage = z.infer<typeof OutputLanguageSchema>;
export type QualityRisk = z.infer<typeof QualityRiskSchema>;
export type DictationContext = z.infer<typeof DictationContextSchema>;
export type DictionaryTerm = z.infer<typeof DictionaryTermSchema>;
export type DictationPreferences = z.infer<typeof DictationPreferencesSchema>;
export type DictationProcessRequest = z.infer<typeof DictationProcessRequestSchema>;
export type DictationSuccessResponse = z.infer<typeof DictationSuccessResponseSchema>;
export type DictationErrorResponse = z.infer<typeof DictationErrorResponseSchema>;
