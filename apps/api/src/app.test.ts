import type { LLMClient } from "@wb/ai-core";
import request from "supertest";
import { describe, expect, it } from "vitest";

import { createApp } from "./app";

const llm: LLMClient = {
  async generate() {
    return { answer: "ok", highlightIds: [] };
  },
};

describe("GET /health", () => {
  it("responds with { ok: true }", async () => {
    const response = await request(
      createApp({ llm, webOrigin: "http://localhost:3000" }),
    ).get("/health");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ok: true });
  });
});
