import Fastify from "fastify";
import multipart from "@fastify/multipart";
import type { DictationRouteDeps } from "./dictation/dictationRoute.js";
import { registerDictationRoute } from "./dictation/dictationRoute.js";

export interface ProviderMetadata {
  asr: string;
  llm: string;
}

export interface BuildServerDeps extends DictationRouteDeps {
  providerMetadata?: ProviderMetadata;
}

export function buildServer(deps: BuildServerDeps) {
  const app = Fastify({ logger: false });
  void app.register(multipart);

  app.get("/health", async () => {
    if (!deps.providerMetadata) {
      return { ok: true };
    }

    return {
      ok: true,
      providers: deps.providerMetadata
    };
  });
  void registerDictationRoute(app, deps);

  return app;
}
