import type { AIRequest, Graph } from "@wb/shared-types";
import { describe, expect, it } from "vitest";

import { askAI } from "../src/askAI";
import type { LLMClient, LLMGenerateParams } from "../src/llm";
import { MAX_COLLAB_OPS } from "../src/modes/collaborate";

const graph: Graph = {
  nodes: [
    {
      id: "api",
      kind: "rectangle",
      text: "API",
      x: 0,
      y: 0,
      width: 120,
      height: 60,
    },
    {
      id: "db",
      kind: "ellipse",
      text: "Database",
      x: 400,
      y: 0,
      width: 160,
      height: 70,
    },
  ],
  edges: [{ id: "e1", from: "api", to: "db" }],
};

function mockClient(responses: unknown[]): {
  client: LLMClient;
  calls: LLMGenerateParams[];
} {
  const calls: LLMGenerateParams[] = [];
  let index = 0;

  const client: LLMClient = {
    async generate(params) {
      calls.push(params);
      const response = responses[Math.min(index, responses.length - 1)];
      index += 1;
      return response;
    },
  };

  return { client, calls };
}

function collaborateRequest(
  input = "add a cache between the API and the DB",
): AIRequest {
  return { mode: "collaborate", graph, input };
}

describe("askAI (collaborate mode)", () => {
  it("returns the ops and the narration", async () => {
    const { client } = mockClient([
      {
        ops: [
          {
            type: "add_node",
            node: { id: "new_1", kind: "rectangle", text: "Cache" },
          },
          {
            type: "add_edge",
            edge: { id: "new_e1", from: "api", to: "new_1" },
          },
          {
            type: "add_edge",
            edge: { id: "new_e2", from: "new_1", to: "db" },
          },
        ],
        answer: "Added a cache between the API and the database.",
      },
    ]);

    const response = await askAI(client, collaborateRequest());

    expect(response.answer).toBe(
      "Added a cache between the API and the database.",
    );
    expect(response.ops).toHaveLength(3);
  });

  it("puts the instruction and the rules in the prompt", async () => {
    const { client, calls } = mockClient([{ ops: [], answer: "Done." }]);

    await askAI(client, collaborateRequest("rename the API box"));

    const user = calls[0]?.user ?? "";
    expect(user).toContain("rename the API box");
    expect(user).toContain("never act on ids that do not exist");
    expect(user).toContain(`at most ${MAX_COLLAB_OPS} ops`);
    expect(user).toContain("api");
    expect(calls[0]?.system).toContain("untrusted data");
  });

  it("drops ops with unknown ids but keeps temp ids", async () => {
    const { client } = mockClient([
      {
        ops: [
          { type: "update_node", id: "ghost", patch: { text: "x" } },
          { type: "add_edge", edge: { id: "e2", from: "ghost", to: "api" } },
          { type: "add_edge", edge: { id: "e3", from: "api", to: "db" } },
          {
            type: "add_node",
            node: { id: "new_1", kind: "rectangle", text: "Cache" },
          },
          { type: "add_edge", edge: { id: "e4", from: "db", to: "new_1" } },
          {
            type: "update_node",
            id: "new_1",
            patch: { text: "Cache\nredis" },
          },
          { type: "delete", id: "db" },
        ],
        answer: "Reworked the middle of the flow.",
      },
    ]);

    const response = await askAI(client, collaborateRequest());

    expect(response.ops).toEqual([
      { type: "add_edge", edge: { id: "e3", from: "api", to: "db" } },
      {
        type: "add_node",
        node: { id: "new_1", kind: "rectangle", text: "Cache" },
      },
      { type: "add_edge", edge: { id: "e4", from: "db", to: "new_1" } },
      {
        type: "update_node",
        id: "new_1",
        patch: { text: "Cache\nredis" },
      },
      { type: "delete", id: "db" },
    ]);
  });

  it(`caps the number of ops at ${MAX_COLLAB_OPS}`, async () => {
    const ops = Array.from({ length: 30 }, (_, index) => ({
      type: "update_node",
      id: "api",
      patch: { text: `step ${index}` },
    }));

    const { client } = mockClient([{ ops, answer: "Many small steps." }]);

    const response = await askAI(client, collaborateRequest());

    expect(response.ops).toHaveLength(MAX_COLLAB_OPS);
  });

  it("requires an instruction", async () => {
    const { client, calls } = mockClient([{ ops: [], answer: "Done." }]);

    await expect(
      askAI(client, { mode: "collaborate", graph }),
    ).rejects.toThrow(/requires "input"/);
    expect(calls).toHaveLength(0);
  });

  it("retries when the narration is missing", async () => {
    const { client, calls } = mockClient([
      { ops: [] },
      { ops: [], answer: "Done." },
    ]);

    const response = await askAI(client, collaborateRequest());

    expect(response.answer).toBe("Done.");
    expect(calls).toHaveLength(2);
    expect(calls[1]?.user).toContain("Validation errors");
  });
});
