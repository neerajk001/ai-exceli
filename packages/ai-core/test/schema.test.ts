import type {
  AIRequest,
  Graph,
  Op,
  SchemaField,
} from "@wb/shared-types";
import { describe, expect, it } from "vitest";

import { askAI } from "../src/askAI";
import type { LLMClient, LLMGenerateParams } from "../src/llm";
import {
  isSchemaRequest,
  normalizeSchemaOps,
} from "../src/modes/generate";

const graph: Graph = { nodes: [], edges: [] };

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

function field(
  name: string,
  type: string,
  extra: Partial<SchemaField> = {},
): SchemaField {
  return { name, type, ...extra };
}

function schemaOps(): Op[] {
  const tables: Array<{ id: string; fields: SchemaField[] }> = [
    {
      id: "users",
      fields: [
        field("id", "uuid", {
          primaryKey: true,
          nullable: false,
          default: "gen_random_uuid()",
        }),
        field("username", "varchar(40)", { unique: true, nullable: false }),
        field("email", "varchar(255)", { unique: true, nullable: false }),
        field("manager_id", "uuid", {
          foreignKey: { table: "users", field: "id" },
          nullable: true,
        }),
      ],
    },
    {
      id: "profiles",
      fields: [
        field("id", "uuid", { primaryKey: true }),
        field("user_id", "uuid", {
          unique: true,
          nullable: false,
          foreignKey: { table: "users", field: "id" },
        }),
        field("bio", "text", { nullable: true }),
        field("avatar_url", "text", { nullable: true }),
      ],
    },
    {
      id: "posts",
      fields: [
        field("id", "uuid", { primaryKey: true }),
        field("user_id", "uuid", {
          nullable: false,
          foreignKey: { table: "users", field: "id" },
        }),
        field("body", "text", { nullable: false }),
        field("created_at", "timestamptz", {
          nullable: false,
          default: "now()",
        }),
      ],
    },
    {
      id: "comments",
      fields: [
        field("id", "uuid", { primaryKey: true }),
        field("post_id", "uuid", {
          nullable: false,
          foreignKey: { table: "posts", field: "id" },
        }),
        field("user_id", "uuid", {
          nullable: false,
          foreignKey: { table: "users", field: "id" },
        }),
        field("body", "text", { nullable: false }),
      ],
    },
    {
      id: "follows",
      fields: [
        field("follower_id", "uuid", {
          primaryKey: true,
          foreignKey: { table: "users", field: "id" },
        }),
        field("following_id", "uuid", {
          primaryKey: true,
          foreignKey: { table: "users", field: "id" },
        }),
        field("created_at", "timestamptz", { default: "now()" }),
      ],
    },
    {
      id: "post_likes",
      fields: [
        field("user_id", "uuid", {
          primaryKey: true,
          foreignKey: { table: "users", field: "id" },
        }),
        field("post_id", "uuid", {
          primaryKey: true,
          foreignKey: { table: "posts", field: "id" },
        }),
      ],
    },
    {
      id: "post_media",
      fields: [
        field("id", "uuid", { primaryKey: true }),
        field("post_id", "uuid", {
          nullable: false,
          foreignKey: { table: "posts", field: "id" },
        }),
        field("url", "text", { nullable: false }),
        field("position", "integer", { nullable: false, default: "0" }),
      ],
    },
    {
      id: "sessions",
      fields: [
        field("id", "uuid", { primaryKey: true }),
        field("user_id", "uuid", {
          nullable: false,
          foreignKey: { table: "users", field: "id" },
        }),
        field("token_hash", "text", { unique: true, nullable: false }),
        field("expires_at", "timestamptz", { nullable: false }),
      ],
    },
  ];

  return tables.map(
    (table): Op => ({
      type: "add_node",
      node: {
        id: table.id,
        kind: "rectangle",
        text: table.id,
        fields: table.fields,
      },
    }),
  );
}

describe("schema intent detection", () => {
  it.each([
    "Generate a database schema for a social media app.",
    "Create an ERD for an e-commerce platform.",
    "Design a database schema for a task management app.",
    "Design a database for a booking system.",
    "Generate a data model for a learning platform.",
  ])("detects schema intent: %s", (prompt) => {
    expect(isSchemaRequest(prompt)).toBe(true);
  });

  it.each([
    "Draw a flowchart explaining how login works.",
    "Create an architecture diagram with a database layer.",
    "Create a mind map of marketing ideas.",
    "Show the process for creating an account.",
  ])("keeps non-schema diagrams unchanged: %s", (prompt) => {
    expect(isSchemaRequest(prompt)).toBe(false);
  });
});

describe("normalizeSchemaOps", () => {
  it("derives complete FK-backed relationships and junction tables", () => {
    const result = normalizeSchemaOps(schemaOps(), graph);

    expect(result.ok).toBe(true);

    if (!result.ok) {
      return;
    }

    const nodes = result.ops.filter((op) => op.type === "add_node");
    const edges = result.ops.filter((op) => op.type === "add_edge");

    expect(nodes).toHaveLength(8);
    expect(edges).toHaveLength(11);

    const edge = (from: string, to: string, toField: string) =>
      edges.find(
        (op) =>
          op.type === "add_edge" &&
          op.edge.from === from &&
          op.edge.to === to &&
          op.edge.toField === toField,
      );

    const profileUser = edge("users", "profiles", "user_id");
    const postUser = edge("users", "posts", "user_id");
    const followFollower = edge("users", "follows", "follower_id");
    const likePost = edge("posts", "post_likes", "post_id");
    const selfManager = edge("users", "users", "manager_id");

    expect(profileUser?.type === "add_edge" ? profileUser.edge.cardinality : null)
      .toBe("one-to-one");
    expect(postUser?.type === "add_edge" ? postUser.edge.cardinality : null)
      .toBe("one-to-many");
    expect(followFollower?.type === "add_edge" ? followFollower.edge.label : null)
      .toContain("1:N");
    expect(likePost?.type === "add_edge" ? likePost.edge.fromField : null)
      .toBe("id");
    expect(selfManager?.type === "add_edge" ? selfManager.edge.toField : null)
      .toBe("manager_id");

    for (const op of nodes) {
      if (op.type !== "add_node") {
        continue;
      }

      expect(op.node.kind).toBe("rectangle");
      expect(op.node.fields?.length).toBeGreaterThan(0);
      expect(op.node.fields?.some((candidate) => candidate.primaryKey)).toBe(
        true,
      );
    }
  });

  it("rejects unknown foreign-key references", () => {
    const ops: Op[] = [
      {
        type: "add_node",
        node: {
          id: "posts",
          kind: "rectangle",
          text: "posts",
          fields: [
            field("id", "uuid", { primaryKey: true }),
            field("user_id", "uuid", {
              foreignKey: { table: "missing_users", field: "id" },
            }),
          ],
        },
      },
    ];

    const result = normalizeSchemaOps(ops, graph);

    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(result.message).toContain("unknown table/field");
    }
  });

  it("auto-marks an id field as the primary key when omitted", () => {
    const ops: Op[] = [
      {
        type: "add_node",
        node: {
          id: "tags",
          kind: "rectangle",
          text: "tags",
          fields: [
            field("id", "uuid"),
            field("name", "varchar(80)", { unique: true }),
          ],
        },
      },
    ];

    const result = normalizeSchemaOps(ops, graph);

    expect(result.ok).toBe(true);

    if (result.ok) {
      const node = result.ops.find((op) => op.type === "add_node");
      expect(
        node?.type === "add_node" &&
          node.node.fields?.find((candidate) => candidate.name === "id")
            ?.primaryKey,
      ).toBe(true);
    }
  });
});

describe("askAI schema generation", () => {
  const request = (input: string): AIRequest => ({
    mode: "generate",
    graph,
    input,
  });

  it("uses the schema prompt and returns normalized tables and edges", async () => {
    const { client, calls } = mockClient([
      { ops: schemaOps(), answer: "Social media schema." },
    ]);

    const response = await askAI(
      client,
      request("Generate a database schema for a social media app."),
    );

    expect(calls).toHaveLength(1);
    expect(calls[0]?.system).toContain("RELATIONSHIP DIRECTION");
    expect(calls[0]?.system).toContain("foreignKey");
    expect(calls[0]?.system).toContain("junction table");
    expect(calls[0]?.user).toContain("social media");

    const nodes = response.ops?.filter((op) => op.type === "add_node") ?? [];
    const edges = response.ops?.filter((op) => op.type === "add_edge") ?? [];

    expect(nodes.length).toBeGreaterThanOrEqual(8);
    expect(edges.length).toBeGreaterThanOrEqual(8);
    expect(
      nodes.every(
        (op) =>
          op.type === "add_node" &&
          (op.node.fields?.length ?? 0) > 0,
      ),
    ).toBe(true);
  });

  it.each([
    "Generate a database schema for a social media app.",
    "Create an ERD for an e-commerce platform.",
    "Design a database schema for a task management app.",
  ])("uses schema mode for: %s", async (prompt) => {
    const { client, calls } = mockClient([
      { ops: schemaOps(), answer: "Schema." },
    ]);

    const response = await askAI(client, request(prompt));

    expect(calls[0]?.system).toContain("RELATIONSHIP DIRECTION");
    expect(calls[0]?.user).toContain(prompt);
    expect(
      response.ops?.filter((op) => op.type === "add_node").every(
        (op) => op.type === "add_node" && (op.node.fields?.length ?? 0) > 0,
      ),
    ).toBe(true);
  });

  it("normalizes an e-commerce schema with a junction table", () => {
    const ops: Op[] = [
      {
        type: "add_node",
        node: {
          id: "orders",
          kind: "rectangle",
          text: "orders",
          fields: [
            field("id", "uuid", { primaryKey: true }),
            field("user_id", "uuid", {
              nullable: false,
              foreignKey: { table: "users", field: "id" },
            }),
            field("status", "varchar(30)", { nullable: false }),
            field("total_amount", "numeric(12,2)", { nullable: false }),
          ],
        },
      },
      {
        type: "add_node",
        node: {
          id: "users",
          kind: "rectangle",
          text: "users",
          fields: [
            field("id", "uuid", { primaryKey: true }),
            field("email", "varchar(255)", {
              unique: true,
              nullable: false,
            }),
          ],
        },
      },
      {
        type: "add_node",
        node: {
          id: "products",
          kind: "rectangle",
          text: "products",
          fields: [
            field("id", "uuid", { primaryKey: true }),
            field("name", "text", { nullable: false }),
            field("price", "numeric(12,2)", { nullable: false }),
          ],
        },
      },
      {
        type: "add_node",
        node: {
          id: "order_items",
          kind: "rectangle",
          text: "order_items",
          fields: [
            field("order_id", "uuid", {
              primaryKey: true,
              foreignKey: { table: "orders", field: "id" },
            }),
            field("product_id", "uuid", {
              primaryKey: true,
              foreignKey: { table: "products", field: "id" },
            }),
            field("quantity", "integer", { nullable: false, default: "1" }),
          ],
        },
      },
      {
        type: "add_node",
        node: {
          id: "payments",
          kind: "rectangle",
          text: "payments",
          fields: [
            field("id", "uuid", { primaryKey: true }),
            field("order_id", "uuid", {
              unique: true,
              nullable: false,
              foreignKey: { table: "orders", field: "id" },
            }),
            field("provider", "varchar(40)", { nullable: false }),
            field("status", "varchar(30)", { nullable: false }),
          ],
        },
      },
    ];

    const result = normalizeSchemaOps(ops, graph);

    expect(result.ok).toBe(true);

    if (!result.ok) {
      return;
    }

    const edges = result.ops.filter((op) => op.type === "add_edge");

    expect(
      edges.some(
        (op) =>
          op.type === "add_edge" &&
          op.edge.from === "orders" &&
          op.edge.to === "order_items" &&
          op.edge.toField === "order_id",
      ),
    ).toBe(true);
    expect(
      edges.some(
        (op) =>
          op.type === "add_edge" &&
          op.edge.from === "products" &&
          op.edge.to === "order_items" &&
          op.edge.toField === "product_id",
      ),
    ).toBe(true);
    expect(
      edges.some(
        (op) =>
          op.type === "add_edge" &&
          op.edge.to === "payments" &&
          op.edge.cardinality === "one-to-one",
      ),
    ).toBe(true);
  });

  it("does not force schema mode for a flowchart prompt", async () => {
    const { client, calls } = mockClient([
      {
        ops: [
          {
            type: "add_node",
            node: { id: "start", kind: "ellipse", text: "Login page" },
          },
          {
            type: "add_node",
            node: { id: "check", kind: "diamond", text: "Credentials valid?" },
          },
          {
            type: "add_edge",
            edge: { id: "e1", from: "start", to: "check", label: "submits" },
          },
        ],
        answer: "Login flow.",
      },
    ]);

    const response = await askAI(
      client,
      request("Draw a flowchart explaining how login works."),
    );

    expect(calls).toHaveLength(1);
    expect(calls[0]?.system).not.toContain("RELATIONSHIP DIRECTION");
    expect(response.ops).toHaveLength(3);
  });

  it("retries when a schema response is only a summary node", async () => {
    const { client, calls } = mockClient([
      {
        ops: [
          {
            type: "add_node",
            node: {
              id: "social",
              kind: "rectangle",
              text: "username, profile, posts",
            },
          },
        ],
        answer: "Summary.",
      },
      { ops: schemaOps(), answer: "Social media schema." },
    ]);

    const response = await askAI(
      client,
      request("Generate a schema for social media users."),
    );

    expect(calls).toHaveLength(2);
    expect(calls[1]?.user).toContain("Validation errors");
    expect(calls[1]?.user).toContain("fields");
    expect(response.ops?.length).toBeGreaterThan(8);
  });
});
