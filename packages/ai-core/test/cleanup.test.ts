import type { AIRequest, Graph } from "@wb/shared-types";
import { describe, expect, it } from "vitest";

import { askAI } from "../src/askAI";
import type { LLMClient, LLMGenerateParams } from "../src/llm";

const graph: Graph = {
  nodes: [
    {
      id: "start",
      kind: "rectangle",
      text: "Start",
      x: 0,
      y: 0,
      width: 120,
      height: 60,
    },
    {
      id: "decide",
      kind: "rectangle",
      text: "Is it valid?",
      x: 200,
      y: 40,
      width: 160,
      height: 70,
    },
    {
      id: "done",
      kind: "rectangle",
      text: "done",
      x: 420,
      y: 240,
      width: 120,
      height: 60,
    },
  ],
  edges: [{ id: "e1", from: "start", to: "decide" }],
};

const sketchGraph: Graph = {
  nodes: [
    {
      id: "box",
      kind: "rectangle",
      text: "Box",
      x: 0,
      y: 0,
      width: 120,
      height: 60,
    },
    { id: "scribble", kind: "freedraw", x: 300, y: 100, width: 90, height: 70 },
    { id: "stroke", kind: "freedraw", x: 420, y: 110, width: 120, height: 30 },
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

function cleanupRequest(g: Graph = graph, imageBase64?: string): AIRequest {
  return {
    mode: "cleanup",
    graph: g,
    ...(imageBase64 === undefined ? {} : { imageBase64 }),
  };
}

describe("askAI (cleanup mode)", () => {
  it("keeps update_node and add_edge ops", async () => {
    const { client } = mockClient([
      {
        ops: [
          {
            type: "update_node",
            id: "decide",
            patch: { kind: "diamond", text: "Valid?" },
          },
          {
            type: "add_edge",
            edge: { id: "new_e", from: "decide", to: "done" },
          },
        ],
      },
    ]);

    const response = await askAI(client, cleanupRequest());

    expect(response.ops).toHaveLength(2);
    expect(response.ops?.[0]).toEqual({
      type: "update_node",
      id: "decide",
      patch: { kind: "diamond", text: "Valid?" },
    });
    expect(response.ops?.[1]).toEqual({
      type: "add_edge",
      edge: { id: "new_e", from: "decide", to: "done" },
    });
  });

  it("puts the rules and the graph in the prompt", async () => {
    const { client, calls } = mockClient([{ ops: [] }]);

    await askAI(client, cleanupRequest());

    const user = calls[0]?.user ?? "";
    expect(user).toContain("Never add or delete nodes");
    expect(user).toContain("geometry is handled separately");
    expect(user).toContain("start");
    expect(calls[0]?.system).toContain("untrusted data");
    expect(calls[0]?.imageBase64).toBeUndefined();
  });

  it("strips coordinates and unsupported kinds from patches", async () => {
    const { client } = mockClient([
      {
        ops: [
          {
            type: "update_node",
            id: "decide",
            patch: {
              text: "Valid?",
              kind: "freedraw",
              x: 999,
              y: 999,
              width: 5,
              height: 5,
            },
          },
        ],
      },
    ]);

    const response = await askAI(client, cleanupRequest());

    expect(response.ops).toEqual([
      { type: "update_node", id: "decide", patch: { text: "Valid?" } },
    ]);
  });

  it("never adds or deletes shapes, even when the model asks to", async () => {
    const { client } = mockClient([
      {
        ops: [
          {
            type: "add_node",
            node: { id: "invented", kind: "rectangle", text: "Invented" },
          },
          { type: "delete", id: "done" },
          {
            type: "update_node",
            id: "decide",
            patch: { kind: "diamond" },
          },
        ],
      },
    ]);

    const response = await askAI(client, cleanupRequest());

    expect(response.ops).toEqual([
      { type: "update_node", id: "decide", patch: { kind: "diamond" } },
    ]);
  });

  it("drops ops that reference unknown ids", async () => {
    const { client } = mockClient([
      {
        ops: [
          { type: "update_node", id: "ghost", patch: { text: "x" } },
          { type: "add_edge", edge: { id: "e2", from: "ghost", to: "start" } },
          { type: "add_edge", edge: { id: "e3", from: "decide", to: "ghost" } },
          { type: "add_edge", edge: { id: "e4", from: "start", to: "done" } },
        ],
      },
    ]);

    const response = await askAI(client, cleanupRequest());

    expect(response.ops).toEqual([
      { type: "add_edge", edge: { id: "e4", from: "start", to: "done" } },
    ]);
  });

  it("retries once when ops are missing", async () => {
    const { client, calls } = mockClient([
      { answer: "I tidied it up." },
      {
        ops: [
          { type: "update_node", id: "decide", patch: { kind: "diamond" } },
        ],
      },
    ]);

    const response = await askAI(client, cleanupRequest());

    expect(response.ops).toHaveLength(1);
    expect(calls).toHaveLength(2);
    expect(calls[1]?.user).toContain("Validation errors");
  });

  it("throws when both replies are invalid", async () => {
    const { client, calls } = mockClient([{ ops: "nope" }, { ops: 42 }]);

    await expect(askAI(client, cleanupRequest())).rejects.toThrow(
      /invalid after retry/i,
    );
    expect(calls).toHaveLength(2);
  });

  it("uses the vision prompt and forwards the image when imageBase64 is set", async () => {
    const { client, calls } = mockClient([{ ops: [] }]);

    await askAI(client, cleanupRequest(sketchGraph, "BASE64DATA"));

    expect(calls[0]?.imageBase64).toBe("BASE64DATA");
    expect(calls[0]?.user).toContain("Hand-drawn strokes");
    expect(calls[0]?.user).toContain("scribble");
  });

  it("replaces recognized strokes and drops unsafe ops", async () => {
    const { client } = mockClient([
      {
        ops: [
          { type: "delete", id: "box" },
          { type: "delete", id: "ghost" },
          { type: "delete", id: "scribble" },
          {
            type: "add_node",
            node: {
              id: "new_1",
              kind: "rectangle",
              text: "Redis",
              x: 300,
              y: 100,
              width: 120,
              height: 90,
            },
          },
          { type: "delete", id: "stroke" },
          {
            type: "add_node",
            node: { id: "new_2", kind: "rectangle", text: "Queue" },
          },
          { type: "add_edge", edge: { id: "na", from: "box", to: "new_1" } },
          {
            type: "add_edge",
            edge: { id: "nb", from: "scribble", to: "new_1" },
          },
          { type: "add_edge", edge: { id: "nc", from: "new_1", to: "ghost" } },
        ],
      },
    ]);

    const response = await askAI(client, cleanupRequest(sketchGraph, "IMG"));

    expect(response.ops).toEqual([
      { type: "delete", id: "scribble" },
      {
        type: "add_node",
        node: {
          id: "new_1",
          kind: "rectangle",
          text: "Redis",
          x: 300,
          y: 100,
          width: 120,
          height: 90,
        },
      },
      { type: "add_edge", edge: { id: "na", from: "box", to: "new_1" } },
    ]);
  });

  it("drops a delete when there is no replacement", async () => {
    const { client } = mockClient([
      { ops: [{ type: "delete", id: "scribble" }] },
    ]);

    const response = await askAI(client, cleanupRequest(sketchGraph, "IMG"));

    expect(response.ops).toEqual([]);
  });
});
