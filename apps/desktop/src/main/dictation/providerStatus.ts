export interface ProviderStatus {
  reachable: boolean;
  apiBaseUrl: string;
  asr?: string;
  llm?: string;
}

export interface ProviderStatusInput {
  apiBaseUrl: string;
  fetchImpl?: (url: string) => Promise<{ ok: boolean; json?: () => Promise<unknown> }>;
}

export async function checkProviderStatus(input: ProviderStatusInput): Promise<ProviderStatus> {
  const fetchImpl = input.fetchImpl ?? fetch;
  try {
    const response = await fetchImpl(`${input.apiBaseUrl.replace(/\/+$/, "")}/health`);
    const metadata = response.ok ? parseProviderMetadata(await response.json?.()) : {};
    return {
      reachable: response.ok,
      apiBaseUrl: input.apiBaseUrl,
      ...metadata
    };
  } catch {
    return {
      reachable: false,
      apiBaseUrl: input.apiBaseUrl
    };
  }
}

function parseProviderMetadata(payload: unknown): Pick<ProviderStatus, "asr" | "llm"> {
  if (!payload || typeof payload !== "object") {
    return {};
  }

  const providers = (payload as { providers?: unknown }).providers;
  if (!providers || typeof providers !== "object") {
    return {};
  }

  const value = providers as { asr?: unknown; llm?: unknown };
  return {
    ...(typeof value.asr === "string" ? { asr: value.asr } : {}),
    ...(typeof value.llm === "string" ? { llm: value.llm } : {})
  };
}
