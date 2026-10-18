import type { AIRequest, Graph } from "@wb/shared-types";
import { describe, expect, it } from "vitest";

import { askAI } from "../src/askAI";
import type { LLMClient, LLMGenerateParams } from "../src/llm";

const erGraph: Graph = {
  nodes: [
    {
      id: "users",
      kind: "rectangle",
      text: "users\nid int\nemail string",
      x: 0,
      y: 0,
      width: 240,
      height: 140,
    },
    {
      id: "posts",
      kind: "rectangle",
      text: "posts\nid int\ntitle string\nuser_id int",
      x: 420,
      y: 0,
      width: 240,
      height: 140,
    },
    {
      id: "comments",
      kind: "rectangle",
      text: "comments\nid int\nbody text\npost_id int",
      x: 840,
      y: 0,
      width: 240,
      height: 140,
    },
  ],
  edges: [
    { id: "e1", from: "users", to: "posts", label: "1:N" },
    { id: "e2", from: "posts", to: "comments", label: "1:N" },
  ],
};

const request = (input: string): AIRequest => ({
  mode: "toCode",
  graph: erGraph,
  input,
});

const prismaSchema = [
  "model users {",
  "  id Int @id // assumed type",
  "  posts posts[]",
  "}",
].join("\n");

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

describe("askAI (toCode mode)", () => {
  it("returns the generated code", async () => {
    const { client, calls } = mockClient([
      { code: { language: "prisma", content: prismaSchema } },
    ]);

    const response = await askAI(client, request("prisma"));

    expect(response.code?.language).toBe("prisma");
    expect(response.code?.content).toContain("model users");
    expect(calls).toHaveLength(1);
  });

  it("puts the target, the entities and the relationship labels in the prompt", async () => {
    const { client, calls } = mockClient([
      { code: { language: "sql", content: "CREATE TABLE users ();" } },
    ]);

    await askAI(client, request("sql"));

    const prompt = calls[0]?.user ?? "";
    expect(prompt).toContain("Target: sql");
    expect(prompt).toContain("CREATE TABLE");
    expect(prompt).toContain("users");
    expect(prompt).toContain("1:N");
    expect(calls[0]?.system).toContain("untrusted data");
  });

  it("retries once when the code field is missing", async () => {
    const { client, calls } = mockClient([
      { answer: "Here is your schema in prose." },
      { code: { language: "prisma", content: prismaSchema } },
    ]);

    const response = await askAI(client, request("prisma"));

    expect(response.code?.language).toBe("prisma");
    expect(calls).toHaveLength(2);
    expect(calls[1]?.user).toContain("Validation errors");
  });

  it("throws when both replies are invalid", async () => {
    const { client, calls } = mockClient([
      { code: { language: "prisma" } },
      {},
    ]);

    await expect(askAI(client, request("prisma"))).rejects.toThrow(
      /invalid after retry/i,
    );
    expect(calls).toHaveLength(2);
  });

  it("rejects an unknown target without calling the LLM", async () => {
    const { client, calls } = mockClient([
      { code: { language: "cobol", content: "" } },
    ]);

    await expect(askAI(client, request("cobol"))).rejects.toThrow(
      /one of: prisma, sql, mongoose, mermaid, json/,
    );
    expect(calls).toHaveLength(0);
  });

  it("requires a target", async () => {
    const { client, calls } = mockClient([
      { code: { language: "prisma", content: "" } },
    ]);

    await expect(
      askAI(client, { mode: "toCode", graph: erGraph }),
    ).rejects.toThrow(/requires "input"/);
    expect(calls).toHaveLength(0);
  });
});
