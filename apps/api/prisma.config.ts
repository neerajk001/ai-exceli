import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { defineConfig } from "prisma/config";

const here = dirname(fileURLToPath(import.meta.url));
const candidates = [resolve(here, "../../.env"), resolve(here, ".env")];
const envFile = candidates.find((candidate) => existsSync(candidate));

if (envFile) {
  process.loadEnvFile(envFile);
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: process.env.DIRECT_URL ?? "",
  },
});
