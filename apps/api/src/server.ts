import { createLLMClient } from "@wb/ai-core";

import { createApp } from "./app";
import { loadEnv, loadLocalEnvFile, type Env } from "./env";

function loadServerEnv(): Env {
  loadLocalEnvFile();

  try {
    return loadEnv();
  } catch (error) {
    console.error(
      `\n[api] ${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exit(1);
  }
}

const env = loadServerEnv();
const app = createApp({
  llm: createLLMClient(env),
  webOrigin: env.WEB_ORIGIN,
});

app.listen(env.PORT, () => {
  console.log(`API listening on http://localhost:${env.PORT}`);
});
