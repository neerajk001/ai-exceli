import type { LLMClient } from "@wb/ai-core";
import request from "supertest";
import { describe, expect, it } from "vitest";

import { createApp } from "./app";
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
