import type { Graph, NewEdge, NewNode } from "@wb/shared-types";
import { describe, expect, it } from "vitest";

import {
  chooseLayoutType,
  estimateNodeSize,
  placeNewNodes,
} from "../src/index";

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

type Point = { x: number; y: number };

function crosses(
  first: { from?: Point; to?: Point },
  second: { from?: Point; to?: Point },
): boolean {
  const a = first.from;
  const b = first.to;
  const c = second.from;
  const d = second.to;

  if (!a || !b || !c || !d) {
    return false;
  }

  const orientation = (p: Point, q: Point, r: Point) =>
    (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
  const straddles = (left: number, right: number) =>
    (left > 1e-6 && right < -1e-6) || (left < -1e-6 && right > 1e-6);

  return (
    straddles(orientation(a, b, c), orientation(a, b, d)) &&
    straddles(orientation(c, d, a), orientation(c, d, b))
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

    expect(b.y ?? 0).toBeGreaterThan(a.y ?? 0);
    expect(b.y).toBe(c.y);
    expect(b.x).not.toBe(c.x);
  });

  it("lays out a fan-in across the top instead of a tall column", () => {
    const sources = ["s1", "s2", "s3", "s4", "s5"];
    const nodes: NewNode[] = [
      ...sources.map((id) => ({
        id,
        kind: "rectangle" as const,
        text: id.toUpperCase(),
      })),
      { id: "target", kind: "rectangle", text: "Target" },
    ];
    const edges: NewEdge[] = sources.map((id, index) => ({
      id: `e${index}`,
      from: id,
      to: "target",
    }));

    const placed = placeNewNodes({ nodes: [], edges: [] }, nodes, edges);
    const rows = new Set(
      placed.filter((node) => node.id !== "target").map((node) => node.y),
    );
    const target = placed.find((node) => node.id === "target");
    const source = placed.find((node) => node.id === "s1");

    expect(rows.size).toBe(1);
    expect(target?.y ?? 0).toBeGreaterThan(source?.y ?? 0);

    const positions = new Map(
      placed.map((node) => [
        node.id,
        {
          x: (node.x ?? 0) + (node.width ?? 0) / 2,
          y: (node.y ?? 0) + (node.height ?? 0) / 2,
        },
      ]),
    );
    const segments = edges.map((edge) => ({
      from: positions.get(edge.from),
      to: positions.get(edge.to),
    }));

    for (let i = 0; i < segments.length; i += 1) {
      for (let j = i + 1; j < segments.length; j += 1) {
        const first = segments[i];
        const second = segments[j];

        if (!first || !second) {
          continue;
        }

        expect(crosses(first, second)).toBe(false);
      }
    }
  });

  it("keeps a simple flow compact and evenly spaced", () => {
    const ids = ["a", "b", "c", "d"];
    const nodes: NewNode[] = ids.map((id) => ({
      id,
      kind: "rectangle",
      text: id.toUpperCase(),
    }));
    const edges: NewEdge[] = ids.slice(0, -1).map((id, index) => ({
      id: `e${index}`,
      from: id,
      to: ids[index + 1] ?? id,
    }));

    const placed = placeNewNodes({ nodes: [], edges: [] }, nodes, edges);
    const xs = placed.map((node) => node.x ?? 0);
    const ys = placed.map((node) => node.y ?? 0);
    const widths = placed.map((node) => node.width ?? 0);
    const heights = placed.map((node) => node.height ?? 0);
    const width = Math.max(...xs.map((x, i) => x + (widths[i] ?? 0))) - Math.min(...xs);
    const height = Math.max(...ys.map((y, i) => y + (heights[i] ?? 0))) - Math.min(...ys);

    expect((width * height) / placed.length).toBeLessThan(30000);

    const sorted = [...placed].sort((a, b) => (a.x ?? 0) - (b.x ?? 0));
    const gaps = sorted.slice(0, -1).map((node, index) => {
      const next = sorted[index + 1];

      return (next?.x ?? 0) - ((node.x ?? 0) + (node.width ?? 0));
    });

    for (const gap of gaps) {
      expect(gap).toBeGreaterThan(60);
      expect(gap).toBeLessThan(140);
    }
  });

  it("wraps a five-step process into a balanced two-row layout", () => {
    const ids = ["restaurant", "prepare", "courier", "deliver", "customer"];
    const nodes: NewNode[] = ids.map((id) => ({
      id,
      kind: "rectangle",
      text: id,
    }));
    const edges: NewEdge[] = ids.slice(0, -1).map((id, index) => ({
      id: `e${index}`,
      from: id,
      to: ids[index + 1] ?? id,
    }));

    const placed = placeNewNodes({ nodes: [], edges: [] }, nodes, edges);
    const xs = placed.map((node) => node.x ?? 0);
    const ys = placed.map((node) => node.y ?? 0);
    const widths = placed.map((node) => node.width ?? 0);
    const heights = placed.map((node) => node.height ?? 0);
    const width =
      Math.max(...xs.map((x, index) => x + (widths[index] ?? 0))) - Math.min(...xs);
    const height =
      Math.max(...ys.map((y, index) => y + (heights[index] ?? 0))) - Math.min(...ys);
    const rows = new Set(ys);

    expect(rows.size).toBe(2);
    expect(width / height).toBeLessThan(4);
    expect(height).toBeGreaterThan(140);
    expect(width).toBeLessThan(800);

    const byId = new Map(placed.map((node) => [node.id, node]));
    const fourth = byId.get("deliver");
    const fifth = byId.get("customer");

    expect(fourth?.x ?? 0).toBeGreaterThan(fifth?.x ?? 0);

    for (let i = 0; i < placed.length; i += 1) {
      for (let j = i + 1; j < placed.length; j += 1) {
        expect(overlaps(placed[i] as Rect, placed[j] as Rect)).toBe(false);
      }
    }
  });

  it("wraps a six-node decision flow into a grid", () => {
    const nodes: NewNode[] = [
      { id: "person", kind: "ellipse", text: "Person" },
      { id: "login", kind: "rectangle", text: "Login" },
      { id: "check", kind: "rectangle", text: "Check details" },
      { id: "decision", kind: "diamond", text: "Valid?" },
      { id: "session", kind: "rectangle", text: "Session" },
      { id: "error", kind: "rectangle", text: "Error" },
    ];
    const edges: NewEdge[] = [
      { id: "e1", from: "person", to: "login" },
      { id: "e2", from: "login", to: "check" },
      { id: "e3", from: "check", to: "decision" },
      { id: "e4", from: "decision", to: "session" },
      { id: "e5", from: "decision", to: "error" },
    ];

    const placed = placeNewNodes(
      { nodes: [], edges: [] },
      nodes,
      edges,
      { kind: "flowchart" },
    );
    const xs = placed.map((node) => node.x ?? 0);
    const ys = placed.map((node) => node.y ?? 0);
    const widths = placed.map((node) => node.width ?? 0);
    const heights = placed.map((node) => node.height ?? 0);
    const width =
      Math.max(...xs.map((x, index) => x + (widths[index] ?? 0))) - Math.min(...xs);
    const height =
      Math.max(...ys.map((y, index) => y + (heights[index] ?? 0))) - Math.min(...ys);

    expect(width / Math.max(1, height)).toBeGreaterThan(0.6);
    expect(new Set(xs.map((x) => Math.round(x / 40))).size).toBeGreaterThan(1);
    expect(new Set(ys.map((y) => Math.round(y / 40))).size).toBeGreaterThan(1);

    for (let i = 0; i < placed.length; i += 1) {
      for (let j = i + 1; j < placed.length; j += 1) {
        expect(overlaps(placed[i] as Rect, placed[j] as Rect)).toBe(false);
      }
    }
  });

  it("lays out a tree with the root above grouped children", () => {
    const nodes: NewNode[] = [
      { id: "root", kind: "rectangle", text: "Authentication" },
      { id: "login", kind: "rectangle", text: "Login" },
      { id: "mfa", kind: "rectangle", text: "MFA" },
      { id: "session", kind: "rectangle", text: "Session" },
    ];
    const edges: NewEdge[] = [
      { id: "e1", from: "root", to: "login" },
      { id: "e2", from: "root", to: "mfa" },
      { id: "e3", from: "root", to: "session" },
    ];

    const placed = placeNewNodes({ nodes: [], edges: [] }, nodes, edges);
    const byId = new Map(placed.map((node) => [node.id, node]));
    const root = byId.get("root");
    const children = ["login", "mfa", "session"].map((id) => byId.get(id));
    const childRows = new Set(
      children.map((node) => Math.round((node?.y ?? 0) + (node?.height ?? 0) / 2)),
    );

    expect(childRows.size).toBe(1);
    for (const child of children) {
      expect(child?.y ?? 0).toBeGreaterThan(root?.y ?? 0);
    }
    expect(new Set(children.map((node) => node?.x)).size).toBe(3);
  });

  it("lays out architecture in left-to-right layers", () => {
    const nodes: NewNode[] = [
      { id: "web", kind: "rectangle", text: "Frontend" },
      { id: "api", kind: "rectangle", text: "API" },
      { id: "db", kind: "ellipse", text: "Database" },
    ];
    const edges: NewEdge[] = [
      { id: "e1", from: "web", to: "api" },
      { id: "e2", from: "api", to: "db" },
    ];

    const placed = placeNewNodes(
      { nodes: [], edges: [] },
      nodes,
      edges,
      { kind: "architecture" },
    );
    const byId = new Map(placed.map((node) => [node.id, node]));

    expect(byId.get("api")?.x ?? 0).toBeGreaterThan(byId.get("web")?.x ?? 0);
    expect(byId.get("db")?.x ?? 0).toBeGreaterThan(byId.get("api")?.x ?? 0);
  });

  it("lays out a mind map around a central topic", () => {
    const nodes: NewNode[] = [
      { id: "center", kind: "ellipse", text: "Marketing" },
      { id: "social", kind: "rectangle", text: "Social" },
      { id: "email", kind: "rectangle", text: "Email" },
      { id: "events", kind: "rectangle", text: "Events" },
      { id: "content", kind: "rectangle", text: "Content" },
    ];
    const edges: NewEdge[] = ["social", "email", "events", "content"].map(
      (id, index) => ({ id: `e${index}`, from: "center", to: id }),
    );

    const placed = placeNewNodes(
      { nodes: [], edges: [] },
      nodes,
      edges,
      { kind: "mindmap" },
    );
    const byId = new Map(placed.map((node) => [node.id, node]));
    const center = byId.get("center");
    const children = placed.filter((node) => node.id !== "center");
    const centerX = (center?.x ?? 0) + (center?.width ?? 0) / 2;

    expect(children.some((node) => (node.x ?? 0) < centerX)).toBe(true);
    expect(children.some((node) => (node.x ?? 0) > centerX)).toBe(true);
    expect(new Set(children.map((node) => Math.round(node.y ?? 0))).size).toBeGreaterThan(2);

    for (let i = 0; i < placed.length; i += 1) {
      for (let j = i + 1; j < placed.length; j += 1) {
        expect(overlaps(placed[i] as Rect, placed[j] as Rect)).toBe(false);
      }
    }
  });

  it("lays out a branching architecture top-to-bottom in layers", () => {
    const nodes: NewNode[] = [
      { id: "customer", kind: "ellipse", text: "Customer" },
      { id: "app", kind: "rectangle", text: "Delivery App" },
      { id: "restaurant", kind: "ellipse", text: "Restaurant" },
      { id: "payment", kind: "ellipse", text: "Payment" },
      { id: "delivery", kind: "ellipse", text: "Delivery Partner" },
    ];
    const edges: NewEdge[] = [
      { id: "e1", from: "customer", to: "app" },
      { id: "e2", from: "app", to: "restaurant" },
      { id: "e3", from: "app", to: "payment" },
      { id: "e4", from: "restaurant", to: "delivery" },
      { id: "e5", from: "delivery", to: "customer" },
    ];

    const placed = placeNewNodes(
      { nodes: [], edges: [] },
      nodes,
      edges,
      { kind: "architecture" },
    );
    const xs = placed.map((node) => node.x ?? 0);
    const ys = placed.map((node) => node.y ?? 0);
    const widths = placed.map((node) => node.width ?? 0);
    const heights = placed.map((node) => node.height ?? 0);
    const width =
      Math.max(...xs.map((x, index) => x + (widths[index] ?? 0))) - Math.min(...xs);
    const height =
      Math.max(...ys.map((y, index) => y + (heights[index] ?? 0))) - Math.min(...ys);

    expect(height).toBeGreaterThan(width);
    expect(new Set(ys.map((y) => Math.round(y / 40))).size).toBeGreaterThan(2);
  });

  it("wraps a cyclic five-step architecture instead of one long row", () => {
    const ids = ["customer", "platform", "payment", "restaurant", "partner"];
    const nodes: NewNode[] = ids.map((id) => ({
      id,
      kind: "rectangle",
      text: id,
    }));
    const edges: NewEdge[] = ids.slice(0, -1).map((id, index) => ({
      id: `e${index}`,
      from: id,
      to: ids[index + 1] ?? id,
    }));

    edges.push({ id: "e-cycle", from: "partner", to: "customer" });

    const placed = placeNewNodes(
      { nodes: [], edges: [] },
      nodes,
      edges,
      { kind: "architecture" },
    );
    const xs = placed.map((node) => node.x ?? 0);
    const ys = placed.map((node) => node.y ?? 0);
    const widths = placed.map((node) => node.width ?? 0);
    const heights = placed.map((node) => node.height ?? 0);
    const width =
      Math.max(...xs.map((x, index) => x + (widths[index] ?? 0))) - Math.min(...xs);
    const height =
      Math.max(...ys.map((y, index) => y + (heights[index] ?? 0))) - Math.min(...ys);

    expect(height).toBeGreaterThan(140);
    expect(width).toBeLessThan(1000);
    expect(width / height).toBeLessThan(6);
  });

  it("wraps a tall decision flow into a balanced grid", () => {
    const nodes: NewNode[] = [
      { id: "user", kind: "ellipse", text: "User" },
      { id: "create", kind: "rectangle", text: "Create Link" },
      { id: "unique", kind: "diamond", text: "Code Unique?" },
      { id: "db", kind: "ellipse", text: "Database" },
      { id: "short", kind: "rectangle", text: "Short URL" },
      { id: "redirect", kind: "rectangle", text: "Redirect Request" },
      { id: "cache", kind: "ellipse", text: "Cache" },
      { id: "hit", kind: "diamond", text: "Cache Hit?" },
      { id: "dest", kind: "ellipse", text: "Destination URL" },
    ];
    const edges: NewEdge[] = [
      { id: "e1", from: "user", to: "create" },
      { id: "e2", from: "create", to: "unique" },
      { id: "e3", from: "unique", to: "db" },
      { id: "e4", from: "unique", to: "create" },
      { id: "e5", from: "db", to: "short" },
      { id: "e6", from: "short", to: "user" },
      { id: "e7", from: "user", to: "redirect" },
      { id: "e8", from: "redirect", to: "cache" },
      { id: "e9", from: "cache", to: "hit" },
      { id: "e10", from: "hit", to: "dest" },
      { id: "e11", from: "hit", to: "db" },
      { id: "e12", from: "db", to: "cache" },
      { id: "e13", from: "cache", to: "dest" },
    ];

    const placed = placeNewNodes(
      { nodes: [], edges: [] },
      nodes,
      edges,
      { kind: "flowchart" },
    );
    const xs = placed.map((node) => node.x ?? 0);
    const ys = placed.map((node) => node.y ?? 0);
    const widths = placed.map((node) => node.width ?? 0);
    const heights = placed.map((node) => node.height ?? 0);
    const width =
      Math.max(...xs.map((x, index) => x + (widths[index] ?? 0))) - Math.min(...xs);
    const height =
      Math.max(...ys.map((y, index) => y + (heights[index] ?? 0))) - Math.min(...ys);
    const aspect = width / Math.max(1, height);

    expect(aspect).toBeGreaterThan(0.6);
    expect(aspect).toBeLessThan(4);
    expect(height).toBeGreaterThan(140);

    for (let i = 0; i < placed.length; i += 1) {
      for (let j = i + 1; j < placed.length; j += 1) {
        expect(overlaps(placed[i] as Rect, placed[j] as Rect)).toBe(false);
      }
    }
  });

  it("wraps a six-node branching flowchart", () => {
    const nodes: NewNode[] = [
      { id: "start", kind: "ellipse", text: "Place order" },
      { id: "process", kind: "rectangle", text: "Process order" },
      { id: "decision", kind: "diamond", text: "Order succeeds?" },
      { id: "confirm", kind: "rectangle", text: "Confirm order" },
      { id: "success", kind: "rectangle", text: "Show success" },
      { id: "failure", kind: "rectangle", text: "Show failure" },
    ];
    const edges: NewEdge[] = [
      { id: "e1", from: "start", to: "process" },
      { id: "e2", from: "process", to: "decision" },
      { id: "e3", from: "decision", to: "confirm" },
      { id: "e4", from: "decision", to: "success" },
      { id: "e5", from: "decision", to: "failure" },
    ];

    const placed = placeNewNodes(
      { nodes: [], edges: [] },
      nodes,
      edges,
      { kind: "flowchart" },
    );
    const xs = placed.map((node) => node.x ?? 0);
    const ys = placed.map((node) => node.y ?? 0);
    const widths = placed.map((node) => node.width ?? 0);
    const heights = placed.map((node) => node.height ?? 0);
    const width =
      Math.max(...xs.map((x, index) => x + (widths[index] ?? 0))) - Math.min(...xs);
    const height =
      Math.max(...ys.map((y, index) => y + (heights[index] ?? 0))) - Math.min(...ys);

    expect(width / Math.max(1, height)).toBeGreaterThan(0.6);
  });

  it("wraps a dense architecture into a readable grid", () => {
    const nodes: NewNode[] = Array.from({ length: 12 }, (_, index) => ({
      id: `n${index}`,
      kind: index % 4 === 0 ? "ellipse" : "rectangle",
      text: `Component ${index}`,
    }));
    const edges: NewEdge[] = [];

    for (let index = 0; index < 11; index += 1) {
      edges.push({
        id: `e${index}`,
        from: `n${index}`,
        to: `n${index + 1}`,
      });
    }

    edges.push(
      { id: "x1", from: "n0", to: "n4" },
      { id: "x2", from: "n1", to: "n5" },
      { id: "x3", from: "n2", to: "n6" },
      { id: "x4", from: "n3", to: "n7" },
      { id: "x5", from: "n4", to: "n8" },
      { id: "x6", from: "n5", to: "n9" },
      { id: "x7", from: "n6", to: "n10" },
      { id: "x8", from: "n7", to: "n11" },
      { id: "x9", from: "n8", to: "n2" },
      { id: "x10", from: "n9", to: "n3" },
      { id: "x11", from: "n10", to: "n4" },
      { id: "x12", from: "n11", to: "n5" },
    );

    const placed = placeNewNodes(
      { nodes: [], edges: [] },
      nodes,
      edges,
      { kind: "architecture" },
    );
    const xs = placed.map((node) => node.x ?? 0);
    const ys = placed.map((node) => node.y ?? 0);
    const widths = placed.map((node) => node.width ?? 0);
    const heights = placed.map((node) => node.height ?? 0);
    const width =
      Math.max(...xs.map((x, index) => x + (widths[index] ?? 0))) - Math.min(...xs);
    const height =
      Math.max(...ys.map((y, index) => y + (heights[index] ?? 0))) - Math.min(...ys);
    const aspect = width / Math.max(1, height);

    expect(aspect).toBeGreaterThan(0.8);
    expect(aspect).toBeLessThan(3);
    expect(new Set(ys.map((y) => Math.round(y / 40))).size).toBeGreaterThan(2);

    for (let i = 0; i < placed.length; i += 1) {
      for (let j = i + 1; j < placed.length; j += 1) {
        expect(overlaps(placed[i] as Rect, placed[j] as Rect)).toBe(false);
      }
    }
  });

  it("chooses an explicit layout from the request", () => {
    expect(
      chooseLayoutType(
        "Break down an authentication system into its main components",
      ),
    ).toBe("tree");
    expect(
      chooseLayoutType(
        "Draw a food delivery system with customers, restaurants, payments, and delivery partners",
      ),
    ).toBe("architecture");
    expect(
      chooseLayoutType("Show what happens when a payment succeeds or fails"),
    ).toBe("flowchart");
    expect(
      chooseLayoutType("How does a payment system work under the hood?"),
    ).toBe("architecture");
    expect(chooseLayoutType("Create a mind map of marketing ideas")).toBe(
      "mindmap",
    );
    expect(chooseLayoutType("Explain how authentication works")).toBeUndefined();
    expect(
      chooseLayoutType("Explain how code moves from GitHub to production"),
    ).toBeUndefined();
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
