import type { LLMClient } from "@wb/ai-core";
import cors from "cors";
import express, { type Express } from "express";
import { rateLimit } from "express-rate-limit";

import { errorHandler } from "./middleware/errorHandler";
import { createAiRouter } from "./routes/ai";

export type AppDependencies = {
  llm: LLMClient;
  webOrigin: string;
};

export function createApp({ llm, webOrigin }: AppDependencies): Express {
  const app = express();

  app.use(cors({ origin: webOrigin }));
  app.use(express.json({ limit: "2mb" }));
  app.use(
    rateLimit({
      windowMs: 60_000,
      limit: 20,
      standardHeaders: true,
      legacyHeaders: false,
    }),
  );

  app.get("/health", (_req, res) => {
    res.json({ ok: true });
  });

  // v11: `requireAuth` will be inserted here, before the AI routes.
  app.use("/ai", createAiRouter(llm));

  app.use(errorHandler);

  return app;
}
