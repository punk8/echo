export function formatProviderError(errorCode: string) {
  switch (errorCode) {
    case "config.llm_model_missing":
      return "LLM configuration missing. Set LLM_MODEL.";
    case "config.llm_key_missing":
      return "LLM configuration missing. Set LLM_API_KEY or API_KEY.";
    case "config.llm_missing":
      return "LLM configuration missing. Set LLM_MODEL and LLM_API_KEY.";
    case "config.asr_key_missing":
      return "ASR configuration missing. Set ASR_API_KEY or API_KEY.";
    case "config.asr_missing":
      return "ASR configuration missing. Set ASR_API_KEY or API_KEY.";
    default:
      return `Provider startup error: ${errorCode}`;
  }
}
