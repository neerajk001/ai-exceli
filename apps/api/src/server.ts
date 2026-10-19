import { createLLMClient } from "@wb/ai-core";

import { createApp } from "./app";
import { createSupabaseAuthVerifier } from "./auth/supabase";
import { createPrismaClient } from "./db";
import { loadEnv, loadLocalEnvFile, type Env } from "./env";
import { createPrismaBoardRepository } from "./repositories/prismaBoards";

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
const prisma = createPrismaClient(env.DATABASE_URL);
const app = createApp({
  llm: createLLMClient(env),
  webOrigin: env.WEB_ORIGIN,
  auth: createSupabaseAuthVerifier(env),
  ensureUser: async (user) => {
    await prisma.user.upsert({
      where: { id: user.id },
      update: { email: user.email },
      create: { id: user.id, email: user.email },
    });
  },
  boards: createPrismaBoardRepository(prisma),
});

app.listen(env.PORT, () => {
  console.log(`API listening on http://localhost:${env.PORT}`);
});
