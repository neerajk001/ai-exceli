import { Router } from "express";
import { z, type ZodType } from "zod";

import { HttpError } from "../middleware/errorHandler";
import { getUser, type AuthUser } from "../middleware/requireAuth";
import type { BoardRepository } from "../repositories/boards";
import { formatIssues } from "../validation";

export const MAX_SCENE_BYTES = 5 * 1024 * 1024;

const titleSchema = z.string().trim().min(1).max(120);

const sceneSchema = z.object({
  elements: z.array(z.unknown()),
  appState: z.record(z.string(), z.unknown()).optional(),
});

const createSchema = z.object({
  title: titleSchema,
  scene: sceneSchema.optional(),
});

const updateSchema = z
  .object({
    title: titleSchema.optional(),
    scene: sceneSchema.optional(),
  })
  .refine((value) => value.title !== undefined || value.scene !== undefined, {
    message: "Provide a title and/or a scene",
  });

type Scene = z.infer<typeof sceneSchema>;

export function createBoardsRouter(repository: BoardRepository): Router {
  const router = Router();

  router.get("/", async (_req, res) => {
    const user = requireUser(getUser(res));
    const boards = await repository.listByOwner(user.id);

    res.json({ boards });
  });

  router.post("/", async (req, res) => {
    const user = requireUser(getUser(res));
    const body = parseBody(createSchema, req.body);
    const scene = body.scene ?? { elements: [] };

    ensureSceneSize(scene);

    const board = await repository.create(user.id, body.title, scene);

    res.status(201).json(board);
  });

  router.get("/:id", async (req, res) => {
    const user = requireUser(getUser(res));
    const board = await repository.findById(user.id, req.params.id);

    if (!board) {
      throw notFound();
    }

    res.json(board);
  });

  router.put("/:id", async (req, res) => {
    const user = requireUser(getUser(res));
    const body = parseBody(updateSchema, req.body);

    ensureSceneSize(body.scene);

    const board = await repository.update(user.id, req.params.id, body);

    if (!board) {
      throw notFound();
    }

    res.json(board);
  });

  router.delete("/:id", async (req, res) => {
    const user = requireUser(getUser(res));
    const deleted = await repository.delete(user.id, req.params.id);

    if (!deleted) {
      throw notFound();
    }

    res.status(204).end();
  });

  return router;
}

function requireUser(user: AuthUser | undefined): AuthUser {
  if (!user) {
    throw new HttpError(401, "unauthorized", "Authentication is required.");
  }

  return user;
}

function parseBody<T>(schema: ZodType<T>, body: unknown): T {
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    throw new HttpError(
      400,
      "invalid_request",
      `Invalid board payload: ${formatIssues(parsed.error)}`,
    );
  }

  return parsed.data;
}

function ensureSceneSize(scene: Scene | undefined): void {
  if (scene === undefined) {
    return;
  }

  const size = Buffer.byteLength(JSON.stringify(scene));

  if (size > MAX_SCENE_BYTES) {
    throw new HttpError(
      413,
      "scene_too_large",
      `Scene is ${size} bytes; the limit is ${MAX_SCENE_BYTES}.`,
    );
  }
}

function notFound(): HttpError {
  return new HttpError(404, "not_found", "Board not found.");
}
