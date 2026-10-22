import type { LLMClient } from "@wb/ai-core";
import request from "supertest";
import { describe, expect, it } from "vitest";

import { AI_RATE_LIMIT, BOARD_RATE_LIMIT, createApp } from "./app";
import {
  createInMemoryBoardRepository,
  createTestAuth,
} from "./test-support/fakes";

const llm: LLMClient = {
  async generate() {
    return { answer: "ok", highlightIds: [] };
  },
};

function createTestApp() {
  const { auth, ensureUser } = createTestAuth();

  return createApp({
    llm,
    webOrigin: "http://localhost:3000",
    auth,
    ensureUser,
    boards: createInMemoryBoardRepository(),
  });
}

describe("GET /health", () => {
  it("responds with { ok: true } without authentication", async () => {
    const response = await request(createTestApp()).get("/health");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ok: true });
  });
});

describe("rate limiting", () => {
  const graph = { nodes: [], edges: [] };

  function askFrom(app: ReturnType<typeof createTestApp>, ip: string) {
    return request(app)
      .post("/ai")
      .set("authorization", "Bearer token-a")
      .set("x-forwarded-for", ip)
      .send({ mode: "ask", graph, input: "?" });
  }

  it("limits /ai per proxied client IP", async () => {
    const app = createTestApp();

    for (let index = 0; index < AI_RATE_LIMIT; index += 1) {
      const response = await askFrom(app, "203.0.113.1");

      expect(response.status).toBe(200);
    }

    expect((await askFrom(app, "203.0.113.1")).status).toBe(429);
    expect((await askFrom(app, "203.0.113.2")).status).toBe(200);
  });

  it("allows board autosaves beyond the AI limit", async () => {
    const app = createTestApp();

    expect(BOARD_RATE_LIMIT).toBeGreaterThan(AI_RATE_LIMIT);

    for (let index = 0; index < AI_RATE_LIMIT + 5; index += 1) {
      const response = await request(app)
        .get("/boards")
        .set("authorization", "Bearer token-a")
        .set("x-forwarded-for", "203.0.113.3");

      expect(response.status).toBe(200);
    }
  });
});
