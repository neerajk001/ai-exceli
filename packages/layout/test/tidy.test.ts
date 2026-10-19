import type { Graph, Op } from "@wb/shared-types";
import { describe, expect, it } from "vitest";

import { tidy } from "../src/index";

const GRID = 20;

const messyGraph: Graph = {
  nodes: [
    {
      id: "frontend",
      kind: "rectangle",
      text: "Frontend",
      x: 13,
      y: 7,
      width: 173,
      height: 71,
    },
    {
      id: "auth",
      kind: "rectangle",
      text: "Auth",
      x: 60,
      y: 260,
      width: 121,
      height: 60,
    },
    {
      id: "worker",
      kind: "rectangle",
      text: "Worker",
      x: 70,
      y: 520,
      width: 135,
      height: 64,
    },
    {
      id: "api",
      kind: "diamond",
      text: "API",
      x: 40,
      y: 300,
      width: 131,
      height: 63,
    },
    {
      id: "db",
      kind: "ellipse",
      text: "Database",
      x: 800,
      y: 500,
      width: 210,
      height: 90,
    },
    {
      id: "note",
      kind: "text",
      text: "note",
      x: 5,
      y: 5,
      width: 50,
      height: 20,
    },
    {
      id: "scribble",
      kind: "freedraw",
      x: 900,
      y: 900,
      width: 40,
      height: 40,
    },
  ],
  edges: [
    { id: "e1", from: "frontend", to: "api" },
    { id: "e2", from: "auth", to: "api" },
    { id: "e3", from: "worker", to: "api" },
    { id: "e4", from: "api", to: "db" },
  ],
};

type Geometry = { x: number; y: number; width: number; height: number };

function updates(ops: Op[]): Array<{ id: string; geometry: Geometry }> {
  return ops.map((op) => {
    if (op.type !== "update_node") {
      throw new Error(`expected update_node, got ${op.type}`);
    }

    const { x, y, width, height } = op.patch;

    if (
      x === undefined ||
      y === undefined ||
      width === undefined ||
      height === undefined
    ) {
      throw new Error("tidy must emit the full geometry");
    }

    return { id: op.id, geometry: { x, y, width, height } };
  });
}

function patchById(ops: Op[]): Map<string, Geometry> {
  return new Map(updates(ops).map((item) => [item.id, item.geometry]));
}

function requireGeometry(
  patches: Map<string, Geometry>,
  id: string,
): Geometry {
  const geometry = patches.get(id);

  if (!geometry) {
    throw new Error(`missing update for ${id}`);
  }

  return geometry;
}

describe("tidy", () => {
  it("emits update_node ops only, for existing shape nodes", () => {
    const shapeIds = new Set(["frontend", "auth", "worker", "api", "db"]);
    const seen = new Set<string>();

    for (const op of tidy(messyGraph)) {
      expect(op.type).toBe("update_node");

      if (op.type === "update_node") {
        expect(shapeIds.has(op.id)).toBe(true);
        expect(seen.has(op.id)).toBe(false);
        seen.add(op.id);
      }
    }
  });

  it("aligns positions and sizes to the grid", () => {
    for (const { geometry } of updates(tidy(messyGraph))) {
      expect(geometry.x % GRID).toBe(0);
      expect(geometry.y % GRID).toBe(0);
      expect(geometry.width % GRID).toBe(0);
      expect(geometry.height % GRID).toBe(0);
    }
  });

  it("equalizes the size of same-rank nodes", () => {
    const patches = patchById(tidy(messyGraph));
    const frontend = requireGeometry(patches, "frontend");
    const auth = requireGeometry(patches, "auth");
    const worker = requireGeometry(patches, "worker");

    expect(auth.width).toBe(frontend.width);
    expect(worker.width).toBe(frontend.width);
    expect(auth.height).toBe(frontend.height);
    expect(worker.height).toBe(frontend.height);
  });

  it("evens out the vertical spacing inside a rank", () => {
    const patches = patchById(tidy(messyGraph));
    const rows = [
      requireGeometry(patches, "frontend"),
      requireGeometry(patches, "auth"),
      requireGeometry(patches, "worker"),
    ].sort((a, b) => a.y - b.y);

    const firstGap =
      (rows[1]?.y ?? 0) - ((rows[0]?.y ?? 0) + (rows[0]?.height ?? 0));
    const secondGap =
      (rows[2]?.y ?? 0) - ((rows[1]?.y ?? 0) + (rows[1]?.height ?? 0));

    expect(firstGap).toBeGreaterThan(0);
    expect(secondGap).toBe(firstGap);
  });

  it("is deterministic", () => {
    expect(tidy(messyGraph)).toEqual(tidy(messyGraph));
  });

  it("returns no ops on an empty canvas", () => {
    expect(tidy({ nodes: [], edges: [] })).toEqual([]);
  });

  it("returns no ops when the drawing is already tidy", () => {
    const tidyGraph: Graph = {
      nodes: [
        {
          id: "a",
          kind: "rectangle",
          text: "A",
          x: 0,
          y: 0,
          width: 120,
          height: 60,
        },
        {
          id: "b",
          kind: "rectangle",
          text: "B",
          x: 200,
          y: 0,
          width: 120,
          height: 60,
        },
      ],
      edges: [{ id: "e", from: "a", to: "b" }],
    };

    expect(tidy(tidyGraph)).toEqual([]);
  });

  it("is idempotent after applying its own ops", () => {
    const patches = patchById(tidy(messyGraph));
    const nodes = messyGraph.nodes.map((node) => {
      const geometry = patches.get(node.id);
      return geometry ? { ...node, ...geometry } : node;
    });

    expect(tidy({ nodes, edges: messyGraph.edges })).toEqual([]);
  });
});
