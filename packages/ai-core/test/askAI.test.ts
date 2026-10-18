import type { AIRequest, Graph } from "@wb/shared-types";
import { describe, expect, it } from "vitest";

import { askAI } from "../src/askAI";
import type { LLMClient, LLMGenerateParams } from "../src/llm";

const graph: Graph = {
  nodes: [
    {
      id: "frontend",
      kind: "rectangle",
      text: "Frontend",
      x: 0,
      y: 0,
      width: 160,
      height: 70,
    },
    {
      id: "api",
      kind: "rectangle",
      text: "API",
      x: 0,
      y: 160,
      width: 160,
      height: 70,
    },
    {
      id: "db",
      kind: "ellipse",
      text: "Database",
      x: 0,
      y: 320,
      width: 160,
      height: 70,
    },
  ],
  edges: [
    { id: "e1", from: "frontend", to: "api" },
    { id: "e2", from: "api", to: "db" },
  ],
};

const request = (input?: string): AIRequest => ({
  mode: "ask",
  graph,
  input,
});

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

describe("askAI (ask mode)", () => {
  it("returns the validated answer and highlights", async () => {
    const { client, calls } = mockClient([
      {
        answer: "The API connects to the database.",
        highlightIds: ["api", "db"],
      },
    ]);

    const response = await askAI(
      client,
      request("what connects to the database?"),
    );

    expect(response.answer).toBe("The API connects to the database.");
    expect(response.highlightIds).toEqual(["api", "db"]);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.system).toContain("untrusted data");
  });

  it("retries once when the first reply is invalid", async () => {
    const { client, calls } = mockClient([
      { answer: 42 },
      { answer: "The API connects.", highlightIds: ["api"] },
    ]);

    const response = await askAI(
      client,
      request("what connects to the database?"),
    );

    expect(response.answer).toBe("The API connects.");
    expect(calls).toHaveLength(2);
    expect(calls[1]?.user).toContain("Validation errors");
  });

  it("treats a non-JSON reply as invalid and retries", async () => {
    const { client, calls } = mockClient([
      "sorry, here is the answer in plain text",
      { answer: "ok", highlightIds: [] },
    ]);

    const response = await askAI(client, request("q"));

    expect(response.answer).toBe("ok");
    expect(calls).toHaveLength(2);
  });

  it("throws when both replies are invalid", async () => {
    const { client, calls } = mockClient([{ answer: 42 }, { nope: true }]);

    await expect(askAI(client, request("q"))).rejects.toThrow(
      /invalid after retry/i,
    );
    expect(calls).toHaveLength(2);
  });

  it("drops highlightIds that are not real node ids", async () => {
    const { client } = mockClient([
      { answer: "ok", highlightIds: ["api", "ghost", "frontend"] },
    ]);

    const response = await askAI(client, request("q"));

    expect(response.highlightIds).toEqual(["api", "frontend"]);
  });

  it("requires a question for ask mode", async () => {
    const { client, calls } = mockClient([{ answer: "x", highlightIds: [] }]);

    await expect(askAI(client, request())).rejects.toThrow(/requires/i);
    expect(calls).toHaveLength(0);
  });

  it("rejects modes that are not implemented yet", async () => {
    const { client } = mockClient([{ answer: "x", highlightIds: [] }]);

    await expect(askAI(client, { mode: "cleanup", graph })).rejects.toThrow(
      /not implemented/i,
    );
    await expect(askAI(client, { mode: "collaborate", graph })).rejects.toThrow(
      /not implemented/i,
    );
  });
});
