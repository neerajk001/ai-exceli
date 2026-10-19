import type { LLMClient } from "@wb/ai-core";
import request from "supertest";
import { describe, expect, it } from "vitest";

import { createApp } from "../app";
import {
  createInMemoryBoardRepository,
  createTestAuth,
  USER_A,
} from "../test-support/fakes";

const llm: LLMClient = {
  async generate() {
    return { answer: "ok", highlightIds: [] };
  },
};

function createTestApp() {
  const { auth, ensureUser, ensured } = createTestAuth();
  const app = createApp({
    llm,
    webOrigin: "http://localhost:3000",
    auth,
    ensureUser,
    boards: createInMemoryBoardRepository(),
  });

  return { app, ensured };
}

function authorized(
  agent: request.Test,
  token = "token-a",
): request.Test {
  return agent.set("authorization", `Bearer ${token}`);
}

describe("/boards", () => {
  it("creates, lists, loads, updates and deletes a board", async () => {
    const { app } = createTestApp();
    const scene = { elements: [], appState: { viewBackgroundColor: "#ffffff" } };

    const created = await authorized(request(app).post("/boards")).send({
      title: "Flow",
      scene,
    });

    expect(created.status).toBe(201);
    expect(created.body.id).toBeDefined();
    expect(created.body.ownerId).toBe(USER_A.id);

    const boardId = created.body.id as string;

    const list = await authorized(request(app).get("/boards"));

    expect(list.status).toBe(200);
    expect(list.body.boards).toHaveLength(1);
    expect(list.body.boards[0].title).toBe("Flow");
    expect(list.body.boards[0].scene).toBeUndefined();

    const loaded = await authorized(request(app).get(`/boards/${boardId}`));

    expect(loaded.status).toBe(200);
    expect(loaded.body.scene).toEqual(scene);

    const renamed = await authorized(
      request(app).put(`/boards/${boardId}`),
    ).send({ title: "Renamed" });

    expect(renamed.status).toBe(200);
    expect(renamed.body.title).toBe("Renamed");
    expect(renamed.body.scene).toEqual(scene);

    const deleted = await authorized(
      request(app).delete(`/boards/${boardId}`),
    );

    expect(deleted.status).toBe(204);

    const missing = await authorized(request(app).get(`/boards/${boardId}`));

    expect(missing.status).toBe(404);
  });

  it("only lets an owner see, update or delete a board", async () => {
    const { app } = createTestApp();

    const created = await authorized(request(app).post("/boards")).send({
      title: "Secret",
    });
    const boardId = created.body.id as string;

    const list = await authorized(request(app).get("/boards"), "token-b");

    expect(list.status).toBe(200);
    expect(list.body.boards).toEqual([]);

    const get = await authorized(
      request(app).get(`/boards/${boardId}`),
      "token-b",
    );
    const put = await authorized(
      request(app).put(`/boards/${boardId}`),
      "token-b",
    ).send({ title: "Stolen" });
    const del = await authorized(
      request(app).delete(`/boards/${boardId}`),
      "token-b",
    );

    expect(get.status).toBe(404);
    expect(put.status).toBe(404);
    expect(del.status).toBe(404);
  });

  it("bootstraps the user on the first authenticated request", async () => {
    const { app, ensured } = createTestApp();

    await authorized(request(app).get("/boards"));

    expect(ensured).toEqual([USER_A]);
  });

  it("requires a bearer token", async () => {
    const { app } = createTestApp();

    const list = await request(app).get("/boards");
    const create = await request(app).post("/boards").send({ title: "x" });
    const badToken = await authorized(
      request(app).get("/boards"),
      "not-a-token",
    );

    expect(list.status).toBe(401);
    expect(create.status).toBe(401);
    expect(badToken.status).toBe(401);
    expect(list.body.error.code).toBe("unauthorized");
  });

  it("rejects invalid payloads", async () => {
    const { app } = createTestApp();
    const missingTitle = await authorized(
      request(app).post("/boards"),
    ).send({ scene: { elements: [] } });
    const emptyUpdate = await authorized(
      request(app).post("/boards"),
    ).send({ title: "ok" });

    expect(missingTitle.status).toBe(400);
    expect(missingTitle.body.error.code).toBe("invalid_request");

    expect(emptyUpdate.status).toBe(201);

    const boardId = emptyUpdate.body.id as string;
    const update = await authorized(
      request(app).put(`/boards/${boardId}`),
    ).send({});

    expect(update.status).toBe(400);
    expect(update.body.error.code).toBe("invalid_request");
  });

  it("rejects a scene over the size limit", async () => {
    const { app } = createTestApp();

    const response = await authorized(request(app).post("/boards")).send({
      title: "Huge",
      scene: { elements: [{ blob: "x".repeat(5 * 1024 * 1024 + 100) }] },
    });

    expect(response.status).toBe(413);
    expect(response.body.error.code).toBe("scene_too_large");
  });
});
