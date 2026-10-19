import type { LLMClient } from "@wb/ai-core";
import type { Graph } from "@wb/shared-types";
import request from "supertest";
import { describe, expect, it } from "vitest";

import { createApp } from "../app";

const graph: Graph = {
  nodes: [
    {
      id: "a",
      kind: "rectangle",
      text: "A",
      x: 0,
      y: 0,
      width: 10,
      height: 10,
    },
    {
      id: "b",
      kind: "rectangle",
      text: "B",
      x: 0,
      y: 20,
      width: 10,
      height: 10,
    },
  ],
  edges: [{ id: "e1", from: "a", to: "b" }],
};

function appWith(llm: LLMClient) {
  return createApp({ llm, webOrigin: "http://localhost:3000" });
}

const answeringLlm: LLMClient = {
  async generate() {
    return { answer: "A connects to B", highlightIds: ["a", "b"] };
  },
};

describe("POST /ai", () => {
  it("returns 200 with the AI response for a valid request", async () => {
    const response = await request(appWith(answeringLlm))
      .post("/ai")
      .send({ mode: "ask", graph, input: "what connects to B?" });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      answer: "A connects to B",
      highlightIds: ["a", "b"],
    });
  });

  it("returns 400 with the error shape for an invalid body", async () => {
    const response = await request(appWith(answeringLlm))
      .post("/ai")
      .send({ mode: "ask" });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("invalid_request");
    expect(typeof response.body.error.message).toBe("string");
  });

  it("returns 400 for a body that is not JSON", async () => {
    const response = await request(appWith(answeringLlm))
      .post("/ai")
      .set("content-type", "application/json")
      .send("this is not json");

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("invalid_json");
  });

  it("returns 413 for a graph over the node limit", async () => {
    const nodes = Array.from({ length: 301 }, (_, index) => ({
      id: `n${index}`,
      kind: "rectangle" as const,
      x: index,
      y: 0,
      width: 10,
      height: 10,
    }));

    const response = await request(appWith(answeringLlm))
      .post("/ai")
      .send({ mode: "ask", graph: { nodes, edges: [] }, input: "?" });

    expect(response.status).toBe(413);
    expect(response.body.error.code).toBe("graph_too_large");
    expect(response.body.error.message).toContain("300");
  });

  it("returns 500 in the error shape when the LLM fails, without leaking details", async () => {
    const failingLlm: LLMClient = {
      async generate() {
        throw new Error("provider exploded: token=sk-secret-value");
      },
    };

    const response = await request(appWith(failingLlm))
      .post("/ai")
      .send({ mode: "ask", graph, input: "?" });

    expect(response.status).toBe(500);
    expect(response.body.error.code).toBe("internal_error");
    expect(JSON.stringify(response.body)).not.toContain("sk-secret-value");
    expect(JSON.stringify(response.body)).not.toContain("provider exploded");
  });

  it("returns 200 with ops for cleanup mode", async () => {
    const cleanupLlm: LLMClient = {
      async generate() {
        return {
          ops: [{ type: "update_node", id: "a", patch: { kind: "diamond" } }],
        };
      },
    };

    const response = await request(appWith(cleanupLlm))
      .post("/ai")
      .send({ mode: "cleanup", graph });

    expect(response.status).toBe(200);
    expect(response.body.ops).toEqual([
      { type: "update_node", id: "a", patch: { kind: "diamond" } },
    ]);
  });

  it("returns 400 when an image is sent with a non-cleanup mode", async () => {
    const response = await request(appWith(answeringLlm))
      .post("/ai")
      .send({ mode: "ask", graph, input: "?", imageBase64: "aGVsbG8=" });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("invalid_request");
  });

  it("returns 413 when imageBase64 exceeds the character limit", async () => {
    const response = await request(appWith(answeringLlm))
      .post("/ai")
      .send({
        mode: "cleanup",
        graph,
        imageBase64: "a".repeat(3_000_001),
      });

    expect(response.status).toBe(413);
    expect(response.body.error.code).toBe("image_too_large");
  });

  it("returns 413 when the body exceeds the limit", async () => {
    const response = await request(appWith(answeringLlm))
      .post("/ai")
      .send({
        mode: "cleanup",
        graph,
        imageBase64: "a".repeat(4_500_000),
      });

    expect(response.status).toBe(413);
    expect(response.body.error.code).toBe("payload_too_large");
  });

  it("returns ops and the narration for collaborate mode", async () => {
    const collaborateLlm: LLMClient = {
      async generate() {
        return {
          ops: [
            {
              type: "add_node",
              node: { id: "new_1", kind: "rectangle", text: "Cache" },
            },
          ],
          answer: "Added a cache box.",
        };
      },
    };

    const response = await request(appWith(collaborateLlm))
      .post("/ai")
      .send({ mode: "collaborate", graph, input: "add a cache" });

    expect(response.status).toBe(200);
    expect(response.body.answer).toBe("Added a cache box.");
    expect(response.body.ops).toHaveLength(1);
  });

  it("returns 500 when collaborate has no instruction", async () => {
    const response = await request(appWith(answeringLlm))
      .post("/ai")
      .send({ mode: "collaborate", graph });

    expect(response.status).toBe(500);
    expect(response.body.error.code).toBe("internal_error");
  });
});
