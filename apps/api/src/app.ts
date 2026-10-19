import type { LLMClient } from "@wb/ai-core";
import cors from "cors";
import express, { type Express } from "express";
import { rateLimit } from "express-rate-limit";

import { errorHandler } from "./middleware/errorHandler";
import {
  createRequireAuth,
  type AuthUser,
  type AuthVerifier,
} from "./middleware/requireAuth";
import type { BoardRepository } from "./repositories/boards";
import { createAiRouter } from "./routes/ai";
import { createBoardsRouter } from "./routes/boards";

export type AppDependencies = {
  llm: LLMClient;
  webOrigin: string;
  auth: AuthVerifier;
  ensureUser: (user: AuthUser) => Promise<void>;
  boards: BoardRepository;
};

export function createApp({
  llm,
  webOrigin,
  auth,
  ensureUser,
  boards,
}: AppDependencies): Express {
  const app = express();

  app.use(cors({ origin: webOrigin }));
  app.use(express.json({ limit: "6mb" }));
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

  const requireAuth = createRequireAuth({ verifyToken: auth, ensureUser });

  app.use("/ai", requireAuth, createAiRouter(llm));
  app.use("/boards", requireAuth, createBoardsRouter(boards));

  app.use(errorHandler);

  return app;
}
