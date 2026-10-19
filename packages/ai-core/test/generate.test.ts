import type { AIRequest, Graph } from "@wb/shared-types";
import { describe, expect, it } from "vitest";

import { askAI } from "../src/askAI";
import type { LLMClient, LLMGenerateParams } from "../src/llm";
import { MAX_GENERATE_OPS } from "../src/modes/generate";

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
  ],
  edges: [],
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

function generateRequest(
  input = "draw a web app with an API and a database",
): AIRequest {
  return { mode: "generate", graph, input };
}

describe("askAI (generate mode)", () => {
  it("returns generated ops and the narration", async () => {
    const { client } = mockClient([
      {
        ops: [
          {
            type: "add_node",
            node: { id: "new_1", kind: "rectangle", text: "Web" },
          },
          {
            type: "add_node",
            node: { id: "new_2", kind: "rectangle", text: "DB" },
          },
          {
            type: "add_edge",
            edge: { id: "new_e", from: "new_1", to: "new_2" },
          },
        ],
        answer: "Drew a web app in front of a database.",
      },
    ]);

    const response = await askAI(client, generateRequest());

    expect(response.answer).toBe("Drew a web app in front of a database.");
    expect(response.ops).toHaveLength(3);
  });

  it("puts the description and rules in the prompt", async () => {
    const { client, calls } = mockClient([
      {
        ops: [
          {
            type: "add_node",
            node: { id: "new_1", kind: "rectangle", text: "X" },
          },
        ],
        answer: "Done.",
      },
    ]);

    await askAI(client, generateRequest("draw a CI pipeline"));

    const user = calls[0]?.user ?? "";
    expect(user).toContain("draw a CI pipeline");
    expect(user).toContain("temporary id");
    expect(user).toContain(`at most ${MAX_GENERATE_OPS} ops`);
    expect(user).toContain("Never use update_node or delete");
    expect(calls[0]?.system).toContain("untrusted data");
  });

  it("strips geometry from new nodes", async () => {
    const { client } = mockClient([
      {
        ops: [
          {
            type: "add_node",
            node: {
              id: "new_1",
              kind: "rectangle",
              text: "Web",
              x: 900,
              y: 900,
              width: 400,
              height: 300,
            },
          },
        ],
        answer: "Done.",
      },
    ]);

    const response = await askAI(client, generateRequest());

    expect(response.ops).toEqual([
      {
        type: "add_node",
        node: { id: "new_1", kind: "rectangle", text: "Web" },
      },
    ]);
  });

  it("drops update, delete, non-shape and colliding nodes", async () => {
    const { client } = mockClient([
      {
        ops: [
          { type: "update_node", id: "api", patch: { text: "changed" } },
          { type: "delete", id: "api" },
          {
            type: "add_node",
            node: { id: "new_freedraw", kind: "freedraw" },
          },
          {
            type: "add_node",
            node: { id: "api", kind: "rectangle", text: "Duplicate" },
          },
          {
            type: "add_node",
            node: { id: "new_1", kind: "rectangle", text: "Web" },
          },
        ],
        answer: "Done.",
      },
    ]);

    const response = await askAI(client, generateRequest());

    expect(response.ops).toEqual([
      {
        type: "add_node",
        node: { id: "new_1", kind: "rectangle", text: "Web" },
      },
    ]);
  });

  it("keeps edges to existing and temp ids, dropping unknown ones", async () => {
    const { client } = mockClient([
      {
        ops: [
          {
            type: "add_node",
            node: { id: "new_1", kind: "rectangle", text: "Web" },
          },
          { type: "add_edge", edge: { id: "e1", from: "api", to: "new_1" } },
          { type: "add_edge", edge: { id: "e2", from: "new_1", to: "api" } },
          { type: "add_edge", edge: { id: "e3", from: "api", to: "ghost" } },
        ],
        answer: "Done.",
      },
    ]);

    const response = await askAI(client, generateRequest());

    expect(response.ops).toHaveLength(3);
    expect(response.ops?.filter((op) => op.type === "add_edge")).toHaveLength(
      2,
    );
  });

  it(`caps the number of ops at ${MAX_GENERATE_OPS}`, async () => {
    const ops = Array.from({ length: 40 }, (_, index) => ({
      type: "add_node",
      node: {
        id: `new_${index}`,
        kind: "rectangle",
        text: `Node ${index}`,
      },
    }));

    const { client } = mockClient([{ ops, answer: "Many nodes." }]);

    const response = await askAI(client, generateRequest());

    expect(response.ops).toHaveLength(MAX_GENERATE_OPS);
  });

  it("requires a description", async () => {
    const { client, calls } = mockClient([
      { ops: [], answer: "Done." },
    ]);

    await expect(
      askAI(client, { mode: "generate", graph }),
    ).rejects.toThrow(/requires "input"/);
    expect(calls).toHaveLength(0);
  });

  it("retries when there are no usable ops", async () => {
    const { client, calls } = mockClient([
      { ops: [{ type: "delete", id: "api" }], answer: "Cleared it." },
      {
        ops: [
          {
            type: "add_node",
            node: { id: "new_1", kind: "rectangle", text: "Web" },
          },
        ],
        answer: "Drew a web app.",
      },
    ]);

    const response = await askAI(client, generateRequest());

    expect(response.ops).toHaveLength(1);
    expect(calls).toHaveLength(2);
    expect(calls[1]?.user).toContain("Validation errors");
  });
});
