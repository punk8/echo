import "dotenv/config";
import { loadApiEnv } from "./config/env";
import { buildServer } from "./server";
import { OpenAITranscribeProvider } from "./providers/asr/OpenAITranscribeProvider";
import { OpenAICompatibleLLMProvider } from "./providers/llm/OpenAICompatibleLLMProvider";

const env = loadApiEnv(process.env);

const app = buildServer({
  asr: new OpenAITranscribeProvider(env.asr),
  llm: new OpenAICompatibleLLMProvider(env.llm)
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
