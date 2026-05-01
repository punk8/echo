import Fastify from "fastify";
import multipart from "@fastify/multipart";
import type { DictationRouteDeps } from "./dictation/dictationRoute";
import { registerDictationRoute } from "./dictation/dictationRoute";

export function buildServer(deps: DictationRouteDeps) {
  const app = Fastify({ logger: false });
  void app.register(multipart);

  app.get("/health", async () => ({ ok: true }));
  void registerDictationRoute(app, deps);

  return app;
}
