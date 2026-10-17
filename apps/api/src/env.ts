import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3001),
  WEB_ORIGIN: z.string().min(1).default("http://localhost:3000"),
  LLM_PROVIDER: z.string().min(1).default("openai"),
  LLM_API_KEY: z
    .string({ error: "LLM_API_KEY is required" })
    .min(1, "LLM_API_KEY must not be empty"),
  LLM_MODEL: z.string().min(1).default("gpt-4o-mini"),
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = envSchema.safeParse(source);

  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join(".") || "<root>"}: ${issue.message}`)
      .join("; ");

    throw new Error(
      `Invalid environment configuration: ${details}. Copy .env.example to .env and fill it in.`,
    );
  }

  return parsed.data;
}

/** Loads the repo-root `.env` (falling back to `apps/api/.env`) if present. */
export function loadLocalEnvFile(): string | undefined {
  const here = dirname(fileURLToPath(import.meta.url));
  const candidates = [resolve(here, "../../../.env"), resolve(here, "../.env")];
  const found = candidates.find((candidate) => existsSync(candidate));

  if (found) {
    process.loadEnvFile(found);
  }

  return found;
}
