import type { Graph, NewEdge, NewNode } from "@wb/shared-types";
import { describe, expect, it } from "vitest";

import { estimateNodeSize, placeNewNodes } from "../src/index";

type Rect = { x: number; y: number; width: number; height: number };

const graph: Graph = {
  nodes: [
    {
      id: "api",
      kind: "rectangle",
      text: "API",
      x: 0,
      y: 0,
      width: 160,
      height: 70,
    },
    {
      id: "db",
      kind: "ellipse",
      text: "Database",
      x: 0,
      y: 220,
      width: 160,
      height: 70,
    },
  ],
  edges: [{ id: "e1", from: "api", to: "db" }],
};

function overlaps(a: Rect, b: Rect): boolean {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

describe("estimateNodeSize", () => {
  it("uses the minimum size for short text", () => {
    expect(
      estimateNodeSize({ id: "n", kind: "rectangle", text: "API" }),
    ).toEqual({ width: 120, height: 60 });
  });

  it("grows with longer text and wraps at the maximum width", () => {
    const short = estimateNodeSize({
      id: "n",
      kind: "text",
      text: "x".repeat(10),
    });
    const long = estimateNodeSize({
      id: "n",
      kind: "text",
      text: "x".repeat(300),
    });

    expect(long.width).toBe(280);
    expect(long.width).toBeGreaterThan(short.width);
    expect(long.height).toBeGreaterThan(short.height);
  });

  it("counts wrapped lines for the height", () => {
    const one = estimateNodeSize({ id: "n", kind: "text", text: "line" });
    const three = estimateNodeSize({ id: "n", kind: "text", text: "a\nb\nc" });

    expect(three.height).toBeGreaterThan(one.height);
  });
});

describe("placeNewNodes", () => {
  const cache: NewNode = { id: "cache", kind: "rectangle", text: "Cache" };
  const cacheEdges: NewEdge[] = [
    { id: "e2", from: "api", to: "cache" },
    { id: "e3", from: "cache", to: "db" },
  ];

  it("fills in the missing geometry", () => {
    const [placed] = placeNewNodes(graph, [cache], cacheEdges);

    expect(placed).toBeDefined();
    expect(typeof placed?.x).toBe("number");
    expect(typeof placed?.y).toBe("number");
    expect(placed?.width).toBeGreaterThanOrEqual(120);
    expect(placed?.height).toBeGreaterThanOrEqual(60);
  });

  it("never overlaps existing nodes", () => {
    const placed = placeNewNodes(graph, [cache], cacheEdges);

    const existingRects: Rect[] = graph.nodes.map((node) => ({
      x: node.x,
      y: node.y,
      width: node.width,
      height: node.height,
    }));

    for (const node of placed) {
      const rect = node as Rect;
      for (const existing of existingRects) {
        expect(overlaps(rect, existing)).toBe(false);
      }
    }
  });

  it("keeps new nodes from overlapping each other", () => {
    const newNodes: NewNode[] = [
      { id: "a", kind: "rectangle", text: "Cache" },
      { id: "b", kind: "rectangle", text: "Queue" },
      { id: "c", kind: "rectangle", text: "Worker" },
    ];
    const newEdges: NewEdge[] = [
      { id: "e2", from: "api", to: "a" },
      { id: "e3", from: "a", to: "b" },
      { id: "e4", from: "b", to: "db" },
    ];

    const placed = placeNewNodes(graph, newNodes, newEdges);

    for (let i = 0; i < placed.length; i += 1) {
      for (let j = i + 1; j < placed.length; j += 1) {
        expect(overlaps(placed[i] as Rect, placed[j] as Rect)).toBe(false);
      }
    }
  });

  it("places an unconnected node to the right of the bounding box", () => {
    const [placed] = placeNewNodes(
      graph,
      [{ id: "loose", kind: "rectangle", text: "Note" }],
      [],
    );
    const maxX = Math.max(...graph.nodes.map((node) => node.x + node.width));

    expect(placed?.x).toBeGreaterThanOrEqual(maxX);
  });

  it("anchors a connected node near its neighbour", () => {
    const [placed] = placeNewNodes(graph, [cache], cacheEdges);
    const allNodesX = [0, 160];

    expect(placed?.x).toBeGreaterThanOrEqual(Math.min(...allNodesX) - 200);
    expect(placed?.x).toBeLessThanOrEqual(Math.max(...allNodesX) + 400);
  });

  it("preserves provided coordinates when they do not overlap", () => {
    const [placed] = placeNewNodes(
      graph,
      [{ id: "fixed", kind: "rectangle", text: "Fixed", x: 900, y: 900 }],
      [],
    );

    expect(placed?.x).toBe(900);
    expect(placed?.y).toBe(900);
  });

  it("lays out a brand-new diagram with dagre instead of stacking", () => {
    const nodes: NewNode[] = [
      { id: "a", kind: "rectangle", text: "A" },
      { id: "b", kind: "rectangle", text: "B" },
      { id: "c", kind: "rectangle", text: "C" },
    ];
    const edges: NewEdge[] = [
      { id: "e1", from: "a", to: "b" },
      { id: "e2", from: "a", to: "c" },
    ];

    const placed = placeNewNodes({ nodes: [], edges: [] }, nodes, edges);
    const byId = new Map(placed.map((node) => [node.id, node]));
    const a = byId.get("a");
    const b = byId.get("b");
    const c = byId.get("c");

    if (!a || !b || !c) {
      throw new Error("expected all nodes to be placed");
    }

    expect(b.x ?? 0).toBeGreaterThan(a.x ?? 0);
    expect(b.y).not.toBe(c.y);
  });

  it("is deterministic", () => {
    const newNodes: NewNode[] = [
      { id: "a", kind: "rectangle", text: "Cache" },
      { id: "b", kind: "rectangle", text: "Queue" },
    ];

    const first = placeNewNodes(graph, newNodes, cacheEdges);
    const second = placeNewNodes(graph, newNodes, cacheEdges);

    expect(first).toEqual(second);
  });

  it("returns an empty list when there is nothing to place", () => {
    expect(placeNewNodes(graph, [], [])).toEqual([]);
  });
});
