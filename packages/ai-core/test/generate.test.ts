import type { AIRequest, Graph } from "@wb/shared-types";
import { describe, expect, it } from "vitest";

import { askAI } from "../src/askAI";
import type { LLMClient, LLMGenerateParams } from "../src/llm";
import {
  inferGenerateDepth,
  MAX_GENERATE_NODES,
  MAX_GENERATE_OPS,
} from "../src/modes/generate";

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

function chainOps(labels: string[]) {
  const nodes = labels.map((label, index) => ({
    type: "add_node" as const,
    node: { id: `n${index}`, kind: "rectangle" as const, text: label },
  }));
  const edges = labels.slice(0, -1).map((_, index) => ({
    type: "add_edge" as const,
    edge: { id: `e${index}`, from: `n${index}`, to: `n${index + 1}` },
  }));

  return [...nodes, ...edges];
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
    const system = calls[0]?.system ?? "";

    expect(user).toContain("draw a CI pipeline");
    expect(user).toContain("Depth: general");
    expect(system).toContain("visual teacher");
    expect(system).toContain("AUDIENCE");
    expect(system).toContain("STRUCTURE CHOICE");
    expect(system).toContain("no technical background");
    expect(system).toContain("4-7 nodes");
    expect(system).toContain(`${MAX_GENERATE_NODES} nodes`);
    expect(system).toContain("analogy");
    expect(system).toContain("untrusted data");
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
    const ops = [
      {
        type: "add_node",
        node: { id: "new_1", kind: "rectangle", text: "One" },
      },
      ...Array.from({ length: 39 }, () => ({
        type: "add_edge",
        edge: { id: "x", from: "api", to: "new_1" },
      })),
    ];

    const { client } = mockClient([{ ops, answer: "Many edges." }]);

    const response = await askAI(client, generateRequest());

    expect(response.ops).toHaveLength(MAX_GENERATE_OPS);
  });

  it("retries when the diagram has too many nodes", async () => {
    const tooMany = [
      ...Array.from({ length: MAX_GENERATE_NODES + 1 }, (_, index) => ({
        type: "add_node",
        node: { id: `n${index}`, kind: "rectangle", text: `Step ${index}` },
      })),
      ...Array.from({ length: MAX_GENERATE_NODES }, (_, index) => ({
        type: "add_edge",
        edge: { id: `e${index}`, from: `n${index}`, to: `n${index + 1}` },
      })),
    ];
    const { client, calls } = mockClient([
      { ops: tooMany, answer: "Big diagram." },
      {
        ops: [
          {
            type: "add_node",
            node: { id: "new_1", kind: "rectangle", text: "Start" },
          },
          {
            type: "add_node",
            node: { id: "new_2", kind: "rectangle", text: "End" },
          },
          { type: "add_edge", edge: { id: "e", from: "new_1", to: "new_2" } },
        ],
        answer: "Simple diagram.",
      },
    ]);

    const response = await askAI(client, generateRequest());

    expect(response.answer).toBe("Simple diagram.");
    expect(calls).toHaveLength(2);
    expect(calls[1]?.user).toContain("Validation errors");
    expect(calls[1]?.user).toContain("at most 12");
  });

  it("retries when the diagram has disconnected groups", async () => {
    const disconnected = [
      {
        type: "add_node",
        node: { id: "a", kind: "rectangle", text: "A" },
      },
      {
        type: "add_node",
        node: { id: "b", kind: "rectangle", text: "B" },
      },
      {
        type: "add_node",
        node: { id: "c", kind: "rectangle", text: "C" },
      },
      {
        type: "add_node",
        node: { id: "d", kind: "rectangle", text: "D" },
      },
      { type: "add_edge", edge: { id: "e1", from: "a", to: "b" } },
      { type: "add_edge", edge: { id: "e2", from: "c", to: "d" } },
    ];
    const { client, calls } = mockClient([
      { ops: disconnected, answer: "Two groups." },
      {
        ops: [
          {
            type: "add_node",
            node: { id: "new_1", kind: "rectangle", text: "Start" },
          },
          {
            type: "add_node",
            node: { id: "new_2", kind: "rectangle", text: "End" },
          },
          { type: "add_edge", edge: { id: "e", from: "new_1", to: "new_2" } },
        ],
        answer: "One flow.",
      },
    ]);

    const response = await askAI(client, generateRequest());

    expect(response.answer).toBe("One flow.");
    expect(calls[1]?.user).toContain("disconnected");
  });

  it("retries when a concept is not connected", async () => {
    const withOrphan = [
      {
        type: "add_node",
        node: { id: "a", kind: "rectangle", text: "Start" },
      },
      {
        type: "add_node",
        node: { id: "b", kind: "rectangle", text: "End" },
      },
      {
        type: "add_node",
        node: { id: "c", kind: "rectangle", text: "Orphan" },
      },
      { type: "add_edge", edge: { id: "e", from: "a", to: "b" } },
    ];
    const { client, calls } = mockClient([
      { ops: withOrphan, answer: "With orphan." },
      {
        ops: [
          {
            type: "add_node",
            node: { id: "new_1", kind: "rectangle", text: "Start" },
          },
          {
            type: "add_node",
            node: { id: "new_2", kind: "rectangle", text: "End" },
          },
          { type: "add_edge", edge: { id: "e", from: "new_1", to: "new_2" } },
        ],
        answer: "Connected.",
      },
    ]);

    const response = await askAI(client, generateRequest());

    expect(response.answer).toBe("Connected.");
    expect(calls[1]?.user).toContain("not connected to the main flow");
  });

  it("retries when a concept appears twice", async () => {
    const duplicated = [
      {
        type: "add_node",
        node: { id: "a", kind: "rectangle", text: "Login" },
      },
      {
        type: "add_node",
        node: { id: "b", kind: "rectangle", text: " login " },
      },
      { type: "add_edge", edge: { id: "e", from: "a", to: "b" } },
    ];
    const { client, calls } = mockClient([
      { ops: duplicated, answer: "Duplicated." },
      {
        ops: [
          {
            type: "add_node",
            node: { id: "new_1", kind: "rectangle", text: "Start" },
          },
          {
            type: "add_node",
            node: { id: "new_2", kind: "rectangle", text: "End" },
          },
          { type: "add_edge", edge: { id: "e", from: "new_1", to: "new_2" } },
        ],
        answer: "Once each.",
      },
    ]);

    const response = await askAI(client, generateRequest());

    expect(response.answer).toBe("Once each.");
    expect(calls[1]?.user).toContain("appears more than once");
  });

  it("retries when the model adds unrequested advanced components", async () => {
    const withExtras = [
      {
        type: "add_node",
        node: { id: "person", kind: "ellipse", text: "Person" },
      },
      {
        type: "add_node",
        node: { id: "login", kind: "rectangle", text: "Login" },
      },
      {
        type: "add_node",
        node: {
          id: "socket",
          kind: "rectangle",
          text: "WebSocket notifications",
        },
      },
      { type: "add_edge", edge: { id: "e1", from: "person", to: "login" } },
      { type: "add_edge", edge: { id: "e2", from: "login", to: "socket" } },
    ];
    const { client, calls } = mockClient([
      { ops: withExtras, answer: "With extras." },
      {
        ops: [
          {
            type: "add_node",
            node: { id: "new_1", kind: "ellipse", text: "Person" },
          },
          {
            type: "add_node",
            node: { id: "new_2", kind: "rectangle", text: "Login" },
          },
          { type: "add_edge", edge: { id: "e", from: "new_1", to: "new_2" } },
        ],
        answer: "Main flow only.",
      },
    ]);

    const response = await askAI(
      client,
      generateRequest("Generate the authentication system"),
    );

    expect(response.answer).toBe("Main flow only.");
    expect(calls).toHaveLength(2);
    expect(calls[1]?.user).toContain("advanced or unrelated");
  });

  it("allows advanced components when the user asks for them", async () => {
    const { client, calls } = mockClient([
      {
        ops: [
          {
            type: "add_node",
            node: { id: "a", kind: "ellipse", text: "Person" },
          },
          {
            type: "add_node",
            node: { id: "b", kind: "rectangle", text: "Login" },
          },
          {
            type: "add_node",
            node: { id: "c", kind: "diamond", text: "MFA code?" },
          },
          { type: "add_edge", edge: { id: "e1", from: "a", to: "b" } },
          { type: "add_edge", edge: { id: "e2", from: "b", to: "c" } },
        ],
        answer: "With MFA.",
      },
    ]);

    const response = await askAI(
      client,
      generateRequest("Explain authentication with MFA for beginners"),
    );

    expect(response.answer).toBe("With MFA.");
    expect(calls).toHaveLength(1);
  });

  it("retries when a concept points to itself", async () => {
    const { client, calls } = mockClient([
      {
        ops: [
          {
            type: "add_node",
            node: { id: "a", kind: "rectangle", text: "Login" },
          },
          { type: "add_edge", edge: { id: "e", from: "a", to: "a" } },
        ],
        answer: "Loop.",
      },
      {
        ops: [
          {
            type: "add_node",
            node: { id: "new_1", kind: "rectangle", text: "Start" },
          },
          {
            type: "add_node",
            node: { id: "new_2", kind: "rectangle", text: "End" },
          },
          { type: "add_edge", edge: { id: "e", from: "new_1", to: "new_2" } },
        ],
        answer: "Flow.",
      },
    ]);

    const response = await askAI(client, generateRequest());

    expect(response.answer).toBe("Flow.");
    expect(calls[1]?.user).toContain("points to itself");
  });

  it("infers depth from the request", () => {
    expect(
      inferGenerateDepth("Explain online payments to a beginner."),
    ).toBe("beginner");
    expect(
      inferGenerateDepth("How does a payment system work under the hood?"),
    ).toBe("technical");
    expect(
      inferGenerateDepth(
        "Design a production payment architecture with webhooks, retries, idempotency, and order confirmation.",
      ),
    ).toBe("technical");
    expect(
      inferGenerateDepth("Show a simple payment success or failure flow."),
    ).toBe("beginner");
    expect(inferGenerateDepth("Explain how authentication works")).toBe(
      "general",
    );
  });

  it("sends technical depth and guidance to the model", async () => {
    const { client, calls } = mockClient([
      {
        ops: chainOps([
          "Checkout",
          "Payment API",
          "Payment Service",
          "Payment DB",
          "Provider",
          "Webhook Handler",
          "Order Service",
        ]),
        answer: "Under the hood.",
      },
    ]);

    await askAI(
      client,
      generateRequest("How does a payment system work under the hood?"),
    );

    expect(calls[0]?.user).toContain("Depth: technical");
    expect(calls[0]?.system).toContain("synchronous");
    expect(calls[0]?.system).toContain("webhook");
    expect(calls[0]?.system).toContain("tokenization");
  });

  it("allows technical components for technical requests", async () => {
    const { client, calls } = mockClient([
      {
        ops: chainOps([
          "Checkout",
          "Payment API",
          "Payment DB",
          "Payment Service",
          "Provider",
          "Webhook Handler",
          "Order Service",
        ]),
        answer: "Under the hood.",
      },
    ]);

    const response = await askAI(
      client,
      generateRequest("How does a payment system work under the hood?"),
    );

    expect(calls).toHaveLength(1);
    expect(response.ops).toHaveLength(13);
  });

  it("keeps beginner diagrams simple and scoped", async () => {
    const { client, calls } = mockClient([
      {
        ops: chainOps(["Customer", "Checkout", "Database"]),
        answer: "Simple.",
      },
      {
        ops: chainOps(["Customer", "Checkout", "Confirmation"]),
        answer: "Simple.",
      },
    ]);

    const response = await askAI(
      client,
      generateRequest("Explain online payments to a beginner."),
    );

    expect(response.answer).toBe("Simple.");
    expect(calls).toHaveLength(2);
    expect(calls[1]?.user).toContain("advanced or unrelated");
  });

  it("allows detailed graphs for technical requests", async () => {
    const labels = Array.from({ length: 14 }, (_, index) => `Part ${index + 1}`);
    const { client, calls } = mockClient([
      { ops: chainOps(labels), answer: "Detailed." },
    ]);

    const response = await askAI(
      client,
      generateRequest(
        "Design a production payment architecture with webhooks, retries, idempotency, and order confirmation.",
      ),
    );

    expect(calls).toHaveLength(1);
    expect(response.ops).toHaveLength(27);
  });

  it("prunes unconnected nodes in technical diagrams", async () => {
    const ops = [
      ...chainOps([
        "Checkout",
        "Payment API",
        "Payment DB",
        "Payment Service",
        "Provider",
        "Webhook Handler",
      ]),
      {
        type: "add_node",
        node: { id: "orphan", kind: "diamond", text: "No Action" },
      },
    ];
    const { client, calls } = mockClient([
      { ops, answer: "Under the hood." },
    ]);

    const response = await askAI(
      client,
      generateRequest("How does a payment system work under the hood?"),
    );

    expect(calls).toHaveLength(1);
    expect(response.ops).toHaveLength(11);
    expect(
      response.ops?.some(
        (op) => op.type === "add_node" && op.node.id === "orphan",
      ),
    ).toBe(false);
  });

  it("renames edge ids that collide with node ids", async () => {
    const { client } = mockClient([
      {
        ops: [
          {
            type: "add_node",
            node: { id: "a", kind: "rectangle", text: "A" },
          },
          {
            type: "add_node",
            node: { id: "b", kind: "rectangle", text: "B" },
          },
          { type: "add_edge", edge: { id: "a", from: "a", to: "b" } },
        ],
        answer: "Fixed ids.",
      },
    ]);

    const response = await askAI(client, generateRequest());
    const edge = response.ops?.find((op) => op.type === "add_edge");

    expect(edge?.type === "add_edge" ? edge.edge.id : "").toBe("edge_a");
  });

  it("allows advanced login methods when the request asks for login methods", async () => {
    const { client, calls } = mockClient([
      {
        ops: chainOps([
          "User",
          "Login methods: password, SSO, passkey, MFA",
          "Verify",
          "Session",
          "Recovery",
        ]),
        answer: "Login methods.",
      },
    ]);

    const response = await askAI(
      client,
      generateRequest(
        "Draw an authentication system with login methods, verification, sessions, and recovery.",
      ),
    );

    expect(calls).toHaveLength(1);
    expect(response.answer).toBe("Login methods.");
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
