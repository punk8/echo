export interface ASRInput {
  audio: Buffer;
  filename: string;
  mimeType: "audio/webm" | "audio/wav";
  language: string;
  prompt?: string;
}

export interface ASRResult {
  rawText: string;
  language: string;
  provider: string;
  durationMs?: number;
}

export interface ASRProvider {
  transcribe(input: ASRInput): Promise<ASRResult>;
}
