export interface ProviderStatus {
  reachable: boolean;
  apiBaseUrl: string;
}

export interface ProviderStatusInput {
  apiBaseUrl: string;
  fetchImpl?: (url: string) => Promise<{ ok: boolean }>;
}

export async function checkProviderStatus(input: ProviderStatusInput): Promise<ProviderStatus> {
  const fetchImpl = input.fetchImpl ?? fetch;
  try {
    const response = await fetchImpl(`${input.apiBaseUrl.replace(/\/+$/, "")}/health`);
    return {
      reachable: response.ok,
      apiBaseUrl: input.apiBaseUrl
    };
  } catch {
    return {
      reachable: false,
      apiBaseUrl: input.apiBaseUrl
    };
  }
}
