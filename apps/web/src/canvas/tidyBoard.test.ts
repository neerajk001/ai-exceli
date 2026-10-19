import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import { excalidrawToGraph } from "@wb/scene-graph";
import type { Graph } from "@wb/shared-types";
import { describe, expect, it } from "vitest";

import { tidyBoard } from "./tidyBoard";

function rectangle(
  id: string,
  x: number,
  y: number,
  width = 120,
  height = 60,
): ExcalidrawElement {
  return {
    id,
    type: "rectangle",
    x,
    y,
    width,
    height,
    angle: 0,
    strokeColor: "#1e1e1e",
    backgroundColor: "transparent",
    fillStyle: "solid",
    strokeWidth: 2,
    strokeStyle: "solid",
    roughness: 1,
    opacity: 100,
    groupIds: [],
    frameId: null,
    index: null,
    roundness: null,
    seed: 1,
    version: 1,
    versionNonce: id.length,
    isDeleted: false,
    boundElements: [],
    updated: 0,
    link: null,
    locked: false,
  } as unknown as ExcalidrawElement;
}

const graph: Graph = {
  nodes: [
    {
      id: "a",
      kind: "rectangle",
      text: "A",
      x: 13,
      y: 7,
      width: 121,
      height: 61,
    },
    {
      id: "b",
      kind: "rectangle",
      text: "B",
      x: 61,
      y: 263,
      width: 173,
      height: 71,
    },
  ],
  edges: [{ id: "e", from: "a", to: "b" }],
};

describe("tidyBoard", () => {
  it("applies tidy ops to the elements", () => {
    const elements = [
      rectangle("a", 13, 7, 121, 61),
      rectangle("b", 61, 263, 173, 71),
    ];

    const result = tidyBoard(elements, graph);

    expect(result.ops.length).toBeGreaterThan(0);
    expect(result.skipped).toBe(0);

    const byId = new Map(result.elements.map((element) => [element.id, element]));
    const a = byId.get("a");
    const b = byId.get("b");

    expect(a).toBeDefined();
    expect(b).toBeDefined();
    expect(a?.x).toBe(0);
    expect(a?.y).toBe(0);
    expect(b?.x).toBeGreaterThan(a?.x ?? 0);
    expect((a?.width ?? 0) % 20).toBe(0);
  });

  it("returns no ops for an already tidy board", () => {
    const graphTidy: Graph = {
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
    const elements = [rectangle("a", 0, 0), rectangle("b", 200, 0)];

    const result = tidyBoard(elements, graphTidy);

    expect(result.ops).toEqual([]);
    expect(result.elements).toEqual(elements);
    expect(result.skipped).toBe(0);
  });

  it("works with the graph derived from the elements", () => {
    const elements = [
      rectangle("a", 13, 7, 121, 61),
      rectangle("b", 61, 263, 173, 71),
    ];

    const result = tidyBoard(elements, excalidrawToGraph(elements));

    expect(result.ops.length).toBeGreaterThan(0);
    expect(result.elements).toHaveLength(2);
  });
});
