import "dotenv/config";
import { loadApiEnv } from "./config/env.js";
import { buildServer } from "./server.js";
import { OpenAITranscribeProvider } from "./providers/asr/OpenAITranscribeProvider.js";
import { OpenAICompatibleLLMProvider } from "./providers/llm/OpenAICompatibleLLMProvider.js";

const env = loadApiEnv(process.env);

const app = buildServer({
  asr: new OpenAITranscribeProvider(env.asr),
  llm: new OpenAICompatibleLLMProvider(env.llm),
  providerMetadata: {
    asr: `${env.asr.provider}:${env.asr.model}`,
    llm: `${env.llm.provider}:${env.llm.model}`
  }
});

await app.listen({ host: env.server.host, port: env.server.port });

app.log.info(
  {
    host: env.server.host,
    port: env.server.port,
    asr: `${env.asr.provider}:${env.asr.model}`,
    llm: `${env.llm.provider}:${env.llm.model}`
  },
  "Echo API started"
);
