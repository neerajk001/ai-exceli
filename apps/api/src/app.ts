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

export const AI_RATE_LIMIT = 20;
export const BOARD_RATE_LIMIT = 120;
export const RATE_LIMIT_WINDOW_MS = 60_000;

function createLimiter(limit: number) {
  return rateLimit({
    windowMs: RATE_LIMIT_WINDOW_MS,
    limit,
    standardHeaders: true,
    legacyHeaders: false,
  });
}

export function createApp({
  llm,
  webOrigin,
  auth,
  ensureUser,
  boards,
}: AppDependencies): Express {
  const app = express();

  app.set("trust proxy", 1);

  app.use(cors({ origin: webOrigin }));
  app.use(express.json({ limit: "6mb" }));

  app.get("/health", (_req, res) => {
    res.json({ ok: true });
  });

  const requireAuth = createRequireAuth({ verifyToken: auth, ensureUser });

  app.use(
    "/ai",
    createLimiter(AI_RATE_LIMIT),
    requireAuth,
    createAiRouter(llm),
  );
  app.use(
    "/boards",
    createLimiter(BOARD_RATE_LIMIT),
    requireAuth,
    createBoardsRouter(boards),
  );

  app.use(errorHandler);

  return app;
}
