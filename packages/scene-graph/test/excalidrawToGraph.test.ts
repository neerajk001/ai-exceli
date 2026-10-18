import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import { describe, expect, it } from "vitest";

import { excalidrawToGraph } from "../src/index";
import boundLabelsFixture from "./fixtures/bound-labels.json";
import danglingArrowFixture from "./fixtures/dangling-arrow.json";
import flowchartFixture from "./fixtures/flowchart-10.json";
import freedrawFixture from "./fixtures/freedraw.json";
import erFixture from "./fixtures/users-posts-comments.json";

const asElements = (fixture: unknown): readonly ExcalidrawElement[] =>
  fixture as ExcalidrawElement[];

const flowchart = asElements(flowchartFixture);
const boundLabels = asElements(boundLabelsFixture);
const danglingArrow = asElements(danglingArrowFixture);
const freedraw = asElements(freedrawFixture);
const erDiagram = asElements(erFixture);

describe("excalidrawToGraph", () => {
  describe("flowchart with 10 shapes and 10 arrows", () => {
    const graph = excalidrawToGraph(flowchart);

    it("maps 10 shapes to 10 nodes", () => {
      expect(graph.nodes).toHaveLength(10);
      expect(graph.edges).toHaveLength(10);
    });

    it("does not emit bound labels as separate nodes", () => {
      expect(graph.nodes.some((node) => node.kind === "text")).toBe(false);
    });

    it("keeps the shape kinds and their bound labels", () => {
      const kinds = graph.nodes.reduce<Record<string, number>>((acc, node) => {
        acc[node.kind] = (acc[node.kind] ?? 0) + 1;
        return acc;
      }, {});

      expect(kinds).toEqual({ rectangle: 7, diamond: 2, ellipse: 1 });

      const start = graph.nodes.find((node) => node.text === "Start");
      const decision = graph.nodes.find((node) => node.text === "Valid?");
      const done = graph.nodes.find((node) => node.text === "Done");

      expect(start?.kind).toBe("rectangle");
      expect(decision?.kind).toBe("diamond");
      expect(done?.kind).toBe("ellipse");
    });

    it("wires edges with the right from/to", () => {
      const decision = graph.nodes.find((node) => node.text === "Valid?");
      const error = graph.nodes.find((node) => node.text === "Show error");
      const normalize = graph.nodes.find((node) => node.text === "Normalize");

      const noEdge = graph.edges.find((edge) => edge.label === "no");
      const yesEdge = graph.edges.find((edge) => edge.label === "yes");

      expect(noEdge?.from).toBe(decision?.id);
      expect(noEdge?.to).toBe(error?.id);
      expect(yesEdge?.from).toBe(decision?.id);
      expect(yesEdge?.to).toBe(normalize?.id);
    });

    it("only references existing nodes from edges", () => {
      const nodeIds = new Set(graph.nodes.map((node) => node.id));

      for (const edge of graph.edges) {
        expect(nodeIds.has(edge.from)).toBe(true);
        expect(nodeIds.has(edge.to)).toBe(true);
      }
    });

    it("rounds every coordinate to an integer", () => {
      for (const node of graph.nodes) {
        expect(Number.isInteger(node.x)).toBe(true);
        expect(Number.isInteger(node.y)).toBe(true);
        expect(Number.isInteger(node.width)).toBe(true);
        expect(Number.isInteger(node.height)).toBe(true);
      }
    });
  });

  describe("canvas with bound labels", () => {
    const graph = excalidrawToGraph(boundLabels);

    it("maps every labeled shape to a node with its text", () => {
      expect(graph.nodes).toHaveLength(3);
      expect(graph.edges).toHaveLength(0);
      expect(graph.nodes.map((node) => node.text).sort()).toEqual([
        "Dashboard",
        "Done",
        "Login",
      ]);
    });
  });

  describe("dangling arrows", () => {
    const graph = excalidrawToGraph(danglingArrow);

    it("skips arrows that are missing an end", () => {
      expect(graph.nodes).toHaveLength(2);
      expect(graph.edges).toHaveLength(1);
      expect(graph.edges[0]?.label).toBeUndefined();
    });

    it("keeps the fully bound arrow", () => {
      const [edge] = graph.edges;
      expect(edge).toBeDefined();
      expect(edge?.from).toBeDefined();
      expect(edge?.to).toBeDefined();
    });
  });

  describe("freedraw stroke", () => {
    const graph = excalidrawToGraph(freedraw);

    it("maps the stroke to a freedraw node with a rounded bounding box", () => {
      const stroke = graph.nodes.find((node) => node.kind === "freedraw");

      expect(stroke).toEqual({
        id: expect.any(String),
        kind: "freedraw",
        x: 40,
        y: 40,
        width: 120,
        height: 45,
      });
      expect(stroke).not.toHaveProperty("text");
    });

    it("keeps standalone text as a text node", () => {
      const text = graph.nodes.find((node) => node.kind === "text");
      expect(text?.text).toBe("handwritten note");
    });
  });

  describe("deleted elements", () => {
    it("is skipped entirely", () => {
      const elements = asElements(boundLabelsFixture);
      const target = elements[0];

      const deleted = elements.map((element) =>
        element.id === target?.id ? { ...element, isDeleted: true } : element,
      );

      const graph = excalidrawToGraph(deleted);
      expect(graph.nodes).toHaveLength(2);
      expect(graph.nodes.some((node) => node.id === target?.id)).toBe(false);
    });
  });

  describe("entity-relationship example (users / posts / comments)", () => {
    const graph = excalidrawToGraph(erDiagram);

    it("maps the three entities with their fields", () => {
      expect(graph.nodes).toHaveLength(3);
      expect(
        graph.nodes.find((node) => node.text?.startsWith("users"))?.text,
      ).toContain("email string");
      expect(
        graph.nodes.find((node) => node.text?.startsWith("posts"))?.text,
      ).toContain("user_id int");
      expect(
        graph.nodes.find((node) => node.text?.startsWith("comments"))?.text,
      ).toContain("post_id int");
    });

    it("maps the three relationships with their cardinality labels", () => {
      expect(graph.edges).toHaveLength(3);
      expect(graph.edges.every((edge) => edge.label === "1:N")).toBe(true);
    });

    it("stays under 15% of the raw elements JSON", () => {
      const live = erDiagram.filter((element) => !element.isDeleted);
      const ratio = JSON.stringify(graph).length / JSON.stringify(live).length;

      expect(ratio).toBeLessThan(0.15);
    });
  });

  describe("size", () => {
    it("produces a graph that is under 15% of the raw elements JSON", () => {
      const live = flowchart.filter((element) => !element.isDeleted);
      const rawSize = JSON.stringify(live).length;
      const graphSize = JSON.stringify(excalidrawToGraph(flowchart)).length;

      expect(graphSize / rawSize).toBeLessThan(0.15);
    });
  });

  describe("purity", () => {
    it("does not mutate the input elements", () => {
      const copy = structuredClone(flowchart);
      excalidrawToGraph(flowchart);
      expect(flowchart).toEqual(copy);
    });
  });
});
