import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import {
  placeNewNodes,
  type LayoutKind,
} from "@wb/layout";
import type { NewEdge, NewNode, Op } from "@wb/shared-types";
import { describe, expect, it } from "vitest";

import { applyOps } from "../src/applyOps";
import { edgeLabelArrowId } from "../src/edgeLabels";
import { excalidrawToGraph } from "../src/excalidrawToGraph";
import { validateDiagramLayout } from "../src/validateLayout";

function opsFor(nodes: NewNode[], edges: NewEdge[]): Op[] {
  return [
    ...nodes.map((node): Op => ({ type: "add_node", node })),
    ...edges.map((edge): Op => ({ type: "add_edge", edge })),
  ];
}

function applyLayout(
  nodes: NewNode[],
  edges: NewEdge[],
  kind?: LayoutKind,
) {
  return applyOps([] as ExcalidrawElement[], opsFor(nodes, edges), {
    layout: (graph, newNodes, newEdges) =>
      placeNewNodes(graph, newNodes, newEdges, kind ? { kind } : {}),
  });
}

const branchingNodes: NewNode[] = [
  { id: "training", kind: "ellipse", text: "Training text" },
  { id: "learn", kind: "rectangle", text: "Learn patterns" },
  { id: "predict", kind: "diamond", text: "Predict next token" },
  { id: "network", kind: "rectangle", text: "Neural network" },
  { id: "answer", kind: "rectangle", text: "Generated answer" },
  { id: "prompt", kind: "ellipse", text: "Your prompt" },
  { id: "split", kind: "rectangle", text: "Split into tokens" },
];

const branchingEdges: NewEdge[] = [
  { id: "e1", from: "training", to: "learn", label: "learns from" },
  { id: "e2", from: "learn", to: "network", label: "forms model" },
  { id: "e3", from: "predict", to: "network", label: "calculates" },
  { id: "e4", from: "network", to: "prompt", label: "processed by" },
  { id: "e5", from: "network", to: "answer", label: "builds" },
  { id: "e6", from: "predict", to: "answer", label: "produces" },
  { id: "e7", from: "answer", to: "prompt", label: "answers" },
  { id: "e8", from: "prompt", to: "split", label: "enters" },
];

describe("diagram layout validation", () => {
  it.each<LayoutKind | undefined>([
    undefined,
    "architecture",
    "flowchart",
    "tree",
  ])("keeps a branching graph clean with %s layout", (kind) => {
    const result = applyLayout(branchingNodes, branchingEdges, kind);

    expect(result.skipped).toEqual([]);
    expect(validateDiagramLayout(result.elements)).toEqual([]);
  });

  it("binds every arrow to the intended endpoints and keeps its label attached", () => {
    const result = applyLayout(branchingNodes, branchingEdges);

    for (const edge of branchingEdges) {
      const arrowId = result.idMap.get(edge.id);
      const arrow = result.elements.find((element) => element.id === arrowId);
      const label = result.elements.find(
        (element) =>
          element.type === "text" && edgeLabelArrowId(element) === arrowId,
      );

      expect(arrow?.type).toBe("arrow");
      expect(label).toBeDefined();

      if (arrow?.type === "arrow") {
        expect(arrow.startBinding?.elementId).toBe(
          result.idMap.get(edge.from),
        );
        expect(arrow.endBinding?.elementId).toBe(result.idMap.get(edge.to));
      }

      if (label?.type === "text") {
        expect(label.text.replace(/\n/g, " ")).toBe(edge.label);
      }
    }
  });

  it("stores edge labels outside arrow containers so Excalidraw cannot re-center them", () => {
    const result = applyLayout(branchingNodes, branchingEdges);
    const arrows = result.elements.filter((element) => element.type === "arrow");
    const labels = result.elements.filter(
      (element) =>
        element.type === "text" && edgeLabelArrowId(element) !== undefined,
    );

    expect(labels).toHaveLength(branchingEdges.length);

    for (const label of labels) {
      if (label.type !== "text") {
        continue;
      }

      expect(label.containerId).toBeNull();
      expect(
        arrows.some((arrow) => arrow.id === edgeLabelArrowId(label)),
      ).toBe(true);
    }

    const graph = excalidrawToGraph(result.elements);
    const labelsById = new Map(graph.edges.map((edge) => [edge.id, edge.label]));

    for (const edge of branchingEdges) {
      expect(labelsById.get(result.idMap.get(edge.id) ?? "")).toBe(edge.label);
    }
    expect(graph.nodes.some((node) => node.kind === "text")).toBe(false);
  });

  it("wraps long node labels inside their shapes", () => {
    const nodes: NewNode[] = [
      {
        id: "a",
        kind: "rectangle",
        text: "Validate every incoming request and reject malformed payloads",
      },
      {
        id: "b",
        kind: "rectangle",
        text: "Persist the normalized event in the primary data store",
      },
      { id: "c", kind: "ellipse", text: "Retry with exponential backoff" },
    ];
    const edges: NewEdge[] = [
      { id: "e1", from: "a", to: "b", label: "writes normalized event data" },
      { id: "e2", from: "b", to: "c", label: "fails" },
    ];

    const result = applyLayout(nodes, edges, "flowchart");
    const issues = validateDiagramLayout(result.elements);
    const labels = result.elements.filter(
      (element) =>
        element.type === "text" &&
        element.containerId !== null &&
        element.text.includes("\n"),
    );

    expect(issues).toEqual([]);
    expect(labels.length).toBeGreaterThan(0);
  });

  it("keeps a dense graph free of node, label, and route collisions", () => {
    const nodes: NewNode[] = Array.from({ length: 14 }, (_, index) => ({
      id: `d${index}`,
      kind:
        index % 5 === 0
          ? "ellipse"
          : index % 7 === 0
            ? "diamond"
            : "rectangle",
      text:
        index % 4 === 0
          ? `Long component name number ${index} with details`
          : `Component ${index}`,
    }));
    const edges: NewEdge[] = [
      ...Array.from({ length: 13 }, (_, index) => ({
        id: `de${index}`,
        from: `d${index}`,
        to: `d${index + 1}`,
        label: index % 3 === 0 ? "reads and writes data" : "calls",
      })),
      { id: "dc1", from: "d0", to: "d5", label: "event" },
      { id: "dc2", from: "d1", to: "d7", label: "event" },
      { id: "dc3", from: "d2", to: "d8", label: "event" },
      { id: "dc4", from: "d3", to: "d9", label: "event" },
      { id: "dc5", from: "d4", to: "d10", label: "event" },
      { id: "dc6", from: "d6", to: "d11", label: "event" },
      { id: "dc7", from: "d8", to: "d13", label: "event" },
      { id: "dc8", from: "d12", to: "d0", label: "retry" },
      { id: "dc9", from: "d9", to: "d2", label: "retry" },
      { id: "dc10", from: "d7", to: "d3", label: "retry" },
    ];

    for (const kind of [undefined, "architecture", "flowchart", "tree"] as const) {
      const result = applyLayout(nodes, edges, kind);

      expect(result.skipped).toEqual([]);
      expect(validateDiagramLayout(result.elements)).toEqual([]);
    }
  });

  it("keeps disconnected components separated and valid", () => {
    const nodes: NewNode[] = [
      { id: "a1", kind: "ellipse", text: "Start" },
      { id: "a2", kind: "rectangle", text: "Process" },
      { id: "a3", kind: "rectangle", text: "Finish" },
      { id: "b1", kind: "ellipse", text: "Second start" },
      { id: "b2", kind: "rectangle", text: "Second process" },
      { id: "b3", kind: "rectangle", text: "Second finish" },
    ];
    const edges: NewEdge[] = [
      { id: "ae1", from: "a1", to: "a2", label: "begins" },
      { id: "ae2", from: "a2", to: "a3", label: "ends" },
      { id: "be1", from: "b1", to: "b2", label: "begins" },
      { id: "be2", from: "b2", to: "b3", label: "ends" },
    ];

    const result = applyLayout(nodes, edges);

    expect(result.skipped).toEqual([]);
    expect(validateDiagramLayout(result.elements)).toEqual([]);
  });

  it("keeps cycles readable with labeled return edges", () => {
    const nodes: NewNode[] = [
      { id: "c1", kind: "ellipse", text: "User" },
      { id: "c2", kind: "diamond", text: "Is the request valid?" },
      { id: "c3", kind: "rectangle", text: "Handle request" },
      { id: "c4", kind: "rectangle", text: "Return error" },
    ];
    const edges: NewEdge[] = [
      { id: "ce1", from: "c1", to: "c2", label: "sends" },
      { id: "ce2", from: "c2", to: "c3", label: "yes" },
      { id: "ce3", from: "c2", to: "c4", label: "no" },
      { id: "ce4", from: "c2", to: "c1", label: "retry" },
      { id: "ce5", from: "c3", to: "c2", label: "checks again" },
    ];

    const result = applyLayout(nodes, edges, "flowchart");

    expect(result.skipped).toEqual([]);
    expect(validateDiagramLayout(result.elements)).toEqual([]);
  });

  it("keeps seeded random graphs clean", () => {
    let state = 42;
    const random = () => {
      state = (state * 1664525 + 1013904223) % 4294967296;
      return state / 4294967296;
    };
    const words = [
      "authentication",
      "database",
      "session",
      "queue",
      "cache",
      "validation",
      "notification",
      "gateway",
      "service",
      "worker",
      "payload",
      "retry",
    ];

    for (let run = 0; run < 20; run += 1) {
      const count = 5 + Math.floor(random() * 12);
      const nodes: NewNode[] = Array.from({ length: count }, (_, index) => {
        const word = words[Math.floor(random() * words.length)] ?? "service";
        const long = random() > 0.65;

        return {
          id: `n${index}`,
          kind:
            index === 0
              ? "ellipse"
              : random() > 0.8
                ? "diamond"
                : "rectangle",
          text: long
            ? `Very long ${word} component that handles requests and responses`
            : `${word} ${index}`,
        };
      });
      const edges: NewEdge[] = [];

      for (let index = 1; index < count; index += 1) {
        edges.push({
          id: `e${index}`,
          from: `n${Math.floor(random() * index)}`,
          to: `n${index}`,
          ...(random() > 0.4
            ? { label: random() > 0.7 ? "reads and writes data" : "calls" }
            : {}),
        });
      }

      const extra = Math.floor(random() * 8);

      for (let index = 0; index < extra; index += 1) {
        const from = `n${Math.floor(random() * count)}`;
        const to = `n${Math.floor(random() * count)}`;

        if (from !== to) {
          edges.push({
            id: `x${index}`,
            from,
            to,
            ...(random() > 0.5 ? { label: "retries" } : {}),
          });
        }
      }

      const kind =
        random() > 0.7
          ? "architecture"
          : random() > 0.5
            ? "flowchart"
            : undefined;
      const result = applyLayout(nodes, edges, kind);

      expect(result.layoutIssues).toEqual([]);
      expect(validateDiagramLayout(result.elements)).toEqual([]);
    }
  });

  it("detects node, label, route, and endpoint problems", () => {
    const nodes: NewNode[] = [
      { id: "a", kind: "rectangle", text: "Alpha" },
      { id: "b", kind: "rectangle", text: "Beta" },
      { id: "c", kind: "rectangle", text: "Gamma" },
    ];
    const edges: NewEdge[] = [
      { id: "e", from: "a", to: "b", label: "sends" },
    ];
    const result = applyLayout(nodes, edges);
    const shapes = result.elements.filter(
      (element) =>
        element.type === "rectangle" ||
        element.type === "ellipse" ||
        element.type === "diamond",
    );
    const arrow = result.elements.find((element) => element.type === "arrow");
    const label = result.elements.find(
      (element) =>
        element.type === "text" && edgeLabelArrowId(element) !== undefined,
    );
    const [first, second, third] = shapes;

    if (!first || !second || !third || !arrow || !label) {
      throw new Error("expected a complete layout");
    }

    const overlapping = structuredClone(result.elements);
    const overlappingSecond = overlapping.find(
      (element) => element.id === second.id,
    );
    const overlappingFirst = overlapping.find(
      (element) => element.id === first.id,
    );
    if (overlappingFirst && overlappingSecond) {
      Object.assign(overlappingSecond, {
        x: overlappingFirst.x + 8,
        y: overlappingFirst.y + 8,
      });
    }
    expect(
      validateDiagramLayout(overlapping).some(
        (issue) => issue.type === "node-overlap",
      ),
    ).toBe(true);

    const collidingLabel = structuredClone(result.elements);
    const movedLabel = collidingLabel.find(
      (element) => element.id === label.id,
    );
    if (movedLabel && first) {
      Object.assign(movedLabel, { x: first.x + 8, y: first.y + 8 });
    }
    expect(
      validateDiagramLayout(collidingLabel).some(
        (issue) => issue.type === "label-collision",
      ),
    ).toBe(true);

    const blockedRoute = structuredClone(result.elements);
    const blocker = blockedRoute.find((element) => element.id === third.id);
    const routeArrow = blockedRoute.find(
      (element) => element.id === arrow.id,
    );
    if (blocker && routeArrow && routeArrow.type === "arrow") {
      const firstPoint = routeArrow.points[0];
      const secondPoint = routeArrow.points[1];

      if (firstPoint && secondPoint) {
        const midX =
          routeArrow.x + (firstPoint[0] + secondPoint[0]) / 2;
        const midY =
          routeArrow.y + (firstPoint[1] + secondPoint[1]) / 2;

        Object.assign(blocker, {
          x: midX - blocker.width / 2,
          y: midY - blocker.height / 2,
        });
      }
    }
    expect(
      validateDiagramLayout(blockedRoute).some(
        (issue) => issue.type === "edge-through-node",
      ),
    ).toBe(true);

    const brokenEdge = structuredClone(result.elements);
    const brokenArrow = brokenEdge.find(
      (element) => element.id === arrow.id,
    );
    if (brokenArrow && brokenArrow.type === "arrow") {
      Object.assign(brokenArrow, { endBinding: null });
    }
    expect(
      validateDiagramLayout(brokenEdge).some(
        (issue) => issue.type === "invalid-edge",
      ),
    ).toBe(true);
  });

  it("removes a standalone label when its arrow is deleted", () => {
    const nodes: NewNode[] = [
      { id: "a", kind: "rectangle", text: "First" },
      { id: "b", kind: "rectangle", text: "Second" },
    ];
    const edges: NewEdge[] = [
      { id: "e", from: "a", to: "b", label: "connects" },
    ];
    const created = applyLayout(nodes, edges);
    const arrowId = created.idMap.get("e");

    expect(arrowId).toBeDefined();

    const label = created.elements.find(
      (element) =>
        element.type === "text" && edgeLabelArrowId(element) === arrowId,
    );
    expect(label).toBeDefined();

    const afterDelete = applyOps(
      created.elements,
      [{ type: "delete", id: arrowId as string }],
      { layout: placeNewNodes },
    );

    expect(
      afterDelete.elements.some((element) => element.id === label?.id),
    ).toBe(false);
  });
});
