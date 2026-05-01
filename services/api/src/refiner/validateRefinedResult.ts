import { z } from "zod";
import type { QualityRisk } from "@echo/shared";

const RefinedPayloadSchema = z.object({
  refined_text: z.string(),
  language: z.string().min(1),
  edits: z.array(z.string()).default([]),
  risk: z.enum(["low", "medium", "high"]).default("low"),
  warnings: z.array(z.string()).default([])
});

export interface ValidateRefinedResultInput {
  rawText: string;
  llmContent: string;
  dictionaryTerms: string[];
}

export interface ValidatedRefinedResult {
  refinedText: string;
  language: string;
  edits: string[];
  risk: QualityRisk;
  warnings: string[];
}

export function validateRefinedResult(input: ValidateRefinedResultInput): ValidatedRefinedResult {
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(input.llmContent);
  } catch {
    throw new Error("server.refine_failed");
  }

  const parsed = RefinedPayloadSchema.safeParse(parsedJson);
  if (!parsed.success) {
    throw new Error("server.refine_failed");
  }

  if (input.rawText.trim().length > 0 && parsed.data.refined_text.trim().length === 0) {
    throw new Error("server.refine_failed");
  }

  const warnings = [...parsed.data.warnings];
  let risk: QualityRisk = parsed.data.risk;

  for (const term of input.dictionaryTerms) {
    if (term.length > 0 && input.rawText.includes(term) && !parsed.data.refined_text.includes(term)) {
      warnings.push(`dictionary_term_missing:${term}`);
      if (risk === "low") {
        risk = "medium";
      }
    }
  }

  return {
    refinedText: parsed.data.refined_text,
    language: parsed.data.language,
    edits: parsed.data.edits,
    risk,
    warnings
  };
}
