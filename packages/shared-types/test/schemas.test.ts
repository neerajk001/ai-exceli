import { describe, expect, it } from "vitest";

import {
  aiRequestSchema,
  aiResponseSchema,
  codeTargetSchema,
  edgeSchema,
  graphSchema,
  newNodeSchema,
  nodeSchema,
  opSchema,
} from "../src/index";

const validNode = {
  id: "a",
  kind: "rectangle",
  text: "Start",
  x: 0,
  y: 0,
  width: 100,
  height: 40,
};

describe("nodeSchema", () => {
  it("accepts a valid node", () => {
    expect(nodeSchema.safeParse(validNode).success).toBe(true);
  });

  it("accepts a node without text", () => {
    const { text: _text, ...withoutText } = validNode;
    expect(nodeSchema.safeParse(withoutText).success).toBe(true);
  });

  it("rejects an unknown kind", () => {
    expect(nodeSchema.safeParse({ ...validNode, kind: "circle" }).success).toBe(
      false,
    );
  });

  it("rejects missing geometry", () => {
    expect(nodeSchema.safeParse({ id: "a", kind: "rectangle" }).success).toBe(
      false,
    );
  });
});

describe("newNodeSchema", () => {
  it("accepts only id and kind (layout fills the geometry)", () => {
    expect(
      newNodeSchema.safeParse({ id: "new_1", kind: "rectangle" }).success,
    ).toBe(true);
  });

  it("accepts partial geometry and text", () => {
    expect(
      newNodeSchema.safeParse({ id: "new_1", kind: "text", x: 10, text: "hi" })
        .success,
    ).toBe(true);
  });

  it("rejects a kind that is not a node kind", () => {
    expect(
      newNodeSchema.safeParse({ id: "new_1", kind: "arrow" }).success,
    ).toBe(false);
  });
});

describe("edgeSchema", () => {
  it("accepts a valid edge", () => {
    expect(
      edgeSchema.safeParse({ id: "e1", from: "a", to: "b", label: "yes" })
        .success,
    ).toBe(true);
  });

  it("rejects an edge without a target", () => {
    expect(edgeSchema.safeParse({ id: "e1", from: "a" }).success).toBe(false);
  });
});

describe("graphSchema", () => {
  it("accepts a graph with nodes and edges", () => {
    const graph = {
      nodes: [validNode],
      edges: [{ id: "e1", from: "a", to: "a" }],
    };
    expect(graphSchema.safeParse(graph).success).toBe(true);
  });

  it("rejects edges that are not an array", () => {
    expect(graphSchema.safeParse({ nodes: [], edges: {} }).success).toBe(false);
  });
});

describe("opSchema", () => {
  it("accepts add_node with a temporary id and no geometry", () => {
    expect(
      opSchema.safeParse({
        type: "add_node",
        node: { id: "new_1", kind: "rectangle" },
      }).success,
    ).toBe(true);
  });

  it("accepts add_edge referencing temporary ids", () => {
    expect(
      opSchema.safeParse({
        type: "add_edge",
        edge: { id: "new_2", from: "new_1", to: "a", label: "flow" },
      }).success,
    ).toBe(true);
  });

  it("accepts update_node with a partial patch", () => {
    expect(
      opSchema.safeParse({
        type: "update_node",
        id: "a",
        patch: { text: "New" },
      }).success,
    ).toBe(true);
  });

  it("accepts delete", () => {
    expect(opSchema.safeParse({ type: "delete", id: "a" }).success).toBe(true);
  });

  it("rejects an unknown op type", () => {
    expect(opSchema.safeParse({ type: "move", id: "a" }).success).toBe(false);
  });
});

describe("codeTargetSchema", () => {
  it("accepts every supported target", () => {
    for (const target of ["prisma", "sql", "mongoose", "mermaid", "json"]) {
      expect(codeTargetSchema.safeParse(target).success).toBe(true);
    }
  });

  it("rejects an unknown target", () => {
    expect(codeTargetSchema.safeParse("cobol").success).toBe(false);
  });
});

describe("aiRequestSchema", () => {
  it("accepts ask mode with input", () => {
    expect(
      aiRequestSchema.safeParse({
        mode: "ask",
        graph: { nodes: [], edges: [] },
        input: "What does this diagram show?",
      }).success,
    ).toBe(true);
  });

  it("rejects an unknown mode", () => {
    expect(
      aiRequestSchema.safeParse({
        mode: "chat",
        graph: { nodes: [], edges: [] },
      }).success,
    ).toBe(false);
  });
});

describe("aiResponseSchema", () => {
  it("accepts an ask response", () => {
    expect(
      aiResponseSchema.safeParse({ answer: "A flow", highlightIds: ["a"] })
        .success,
    ).toBe(true);
  });

  it("accepts a toCode response", () => {
    expect(
      aiResponseSchema.safeParse({
        code: { language: "prisma", content: "model User {}" },
      }).success,
    ).toBe(true);
  });

  it("rejects code without content", () => {
    expect(
      aiResponseSchema.safeParse({ code: { language: "prisma" } }).success,
    ).toBe(false);
  });
});
