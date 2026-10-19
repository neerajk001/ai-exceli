import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import type { Op } from "@wb/shared-types";
import { placeNewNodes } from "@wb/layout";
import { describe, expect, it } from "vitest";

import { applyOps } from "../src/applyOps";
import { excalidrawToGraph } from "../src/excalidrawToGraph";
import erFixture from "./fixtures/users-posts-comments.json";

const elements = erFixture as unknown as ExcalidrawElement[];
const graph = excalidrawToGraph(elements);

const postsId = graph.nodes.find((node) => node.text?.startsWith("posts"))?.id;
const commentsId = graph.nodes.find((node) =>
  node.text?.startsWith("comments"),
)?.id;

if (!postsId || !commentsId) {
  throw new Error("fixture is missing the posts/comments nodes");
}

const options = { layout: placeNewNodes };

type Rect = { x: number; y: number; width: number; height: number };

function overlaps(a: Rect, b: Rect): boolean {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

describe("applyOps", () => {
  it("adds a labeled node and a bound arrow, without overlapping", () => {
    const ops: Op[] = [
      {
        type: "add_node",
        node: { id: "new_cache", kind: "rectangle", text: "cache\nredis" },
      },
      {
        type: "add_edge",
        edge: { id: "new_e1", from: postsId, to: "new_cache", label: "reads" },
      },
    ];

    const result = applyOps(elements, ops, options);

    expect(result.skipped).toEqual([]);
    expect(result.elements.length).toBeGreaterThan(elements.length);

    const cacheId = result.idMap.get("new_cache");
    expect(cacheId).toBeDefined();

    const shape = result.elements.find((element) => element.id === cacheId);
    expect(shape?.type).toBe("rectangle");

    const boundText = result.elements.find(
      (element) => element.type === "text" && element.containerId === cacheId,
    );
    expect(boundText?.type === "text" ? boundText.text : undefined).toBe(
      "cache\nredis",
    );

    const arrow = result.elements.find(
      (element) =>
        element.type === "arrow" &&
        (element.startBinding?.elementId === cacheId ||
          element.endBinding?.elementId === cacheId),
    );
    expect(arrow).toBeDefined();
    expect(
      arrow && arrow.type === "arrow" ? arrow.startBinding?.elementId : null,
    ).toBe(postsId);
    expect(
      arrow && arrow.type === "arrow" ? arrow.endBinding?.elementId : null,
    ).toBe(cacheId);

    const boundArrowIds =
      shape?.boundElements?.filter((bound) => bound.type === "arrow") ?? [];
    expect(boundArrowIds).toHaveLength(1);

    const cacheRect: Rect = {
      x: shape?.x ?? 0,
      y: shape?.y ?? 0,
      width: shape?.width ?? 0,
      height: shape?.height ?? 0,
    };

    const otherShapeRects: Rect[] = result.elements
      .filter(
        (element) =>
          element.id !== cacheId &&
          (element.type === "rectangle" ||
            element.type === "ellipse" ||
            element.type === "diamond"),
      )
      .map((element) => ({
        x: element.x,
        y: element.y,
        width: element.width,
        height: element.height,
      }));

    expect(otherShapeRects.length).toBeGreaterThan(0);
    for (const rect of otherShapeRects) {
      expect(overlaps(cacheRect, rect)).toBe(false);
    }
  });

  it("resolves temporary ids in edges to the created element ids", () => {
    const result = applyOps(
      elements,
      [
        {
          type: "add_node",
          node: { id: "new_1", kind: "rectangle", text: "queue" },
        },
        {
          type: "add_node",
          node: { id: "new_2", kind: "rectangle", text: "worker" },
        },
        { type: "add_edge", edge: { id: "new_e", from: "new_1", to: "new_2" } },
      ],
      options,
    );

    expect(result.skipped).toEqual([]);

    const firstId = result.idMap.get("new_1");
    const secondId = result.idMap.get("new_2");
    expect(firstId).toBeDefined();
    expect(secondId).toBeDefined();
    expect(firstId).not.toBe(secondId);

    const arrow = result.elements.find(
      (element) =>
        element.type === "arrow" && element.startBinding?.elementId === firstId,
    );
    expect(arrow).toBeDefined();
    expect(
      arrow && arrow.type === "arrow" ? arrow.endBinding?.elementId : null,
    ).toBe(secondId);
  });

  it("updates the label of an existing node", () => {
    const result = applyOps(
      elements,
      [
        {
          type: "update_node",
          id: postsId,
          patch: { text: "articles\nid int" },
        },
      ],
      options,
    );

    expect(result.skipped).toEqual([]);

    const text = result.elements.find(
      (element) => element.type === "text" && element.containerId === postsId,
    );
    expect(text?.type === "text" ? text.text : undefined).toBe(
      "articles\nid int",
    );
  });

  it("deletes a node together with its label and connected arrows", () => {
    const result = applyOps(
      elements,
      [{ type: "delete", id: commentsId }],
      options,
    );

    expect(result.skipped).toEqual([]);
    expect(result.elements.some((element) => element.id === commentsId)).toBe(
      false,
    );
    expect(
      result.elements.some(
        (element) =>
          element.type === "text" && element.containerId === commentsId,
      ),
    ).toBe(false);
    expect(
      result.elements.some(
        (element) =>
          element.type === "arrow" &&
          (element.startBinding?.elementId === commentsId ||
            element.endBinding?.elementId === commentsId),
      ),
    ).toBe(false);
    expect(
      result.elements.some(
        (element) =>
          element.boundElements?.some((bound) => bound.id === commentsId) ??
          false,
      ),
    ).toBe(false);
  });

  it("skips ops with unknown ids instead of throwing", () => {
    const result = applyOps(
      elements,
      [
        { type: "delete", id: "ghost" },
        { type: "update_node", id: "ghost", patch: { text: "x" } },
        {
          type: "add_edge",
          edge: { id: "e_ghost", from: "ghost", to: postsId },
        },
      ],
      options,
    );

    expect(result.skipped).toHaveLength(3);
    expect(result.skipped[0]?.reason).toContain("ghost");
    expect(result.elements).toHaveLength(elements.length);
  });

  it("does not mutate the input elements", () => {
    const copy = structuredClone(elements);

    applyOps(
      elements,
      [
        { type: "delete", id: commentsId },
        { type: "update_node", id: postsId, patch: { text: "changed" } },
        {
          type: "add_node",
          node: { id: "new_1", kind: "rectangle", text: "extra" },
        },
      ],
      options,
    );

    expect(elements).toEqual(copy);
  });

  it("keeps given geometry exactly when preserveGivenGeometry is set", () => {
    const posts = graph.nodes.find((node) => node.id === postsId);

    if (!posts) {
      throw new Error("fixture is missing the posts node");
    }

    const result = applyOps(
      elements,
      [
        {
          type: "add_node",
          node: {
            id: "new_1",
            kind: "rectangle",
            text: "clean",
            x: posts.x,
            y: posts.y,
            width: posts.width,
            height: posts.height,
          },
        },
      ],
      { layout: placeNewNodes, preserveGivenGeometry: true },
    );

    const created = result.elements.find(
      (element) => element.id === result.idMap.get("new_1"),
    );

    expect(created?.x).toBe(posts.x);
    expect(created?.y).toBe(posts.y);
    expect(created?.width).toBe(posts.width);
    expect(created?.height).toBe(posts.height);
  });

  it("appends the new elements after the existing ones", () => {
    const result = applyOps(
      elements,
      [
        {
          type: "add_node",
          node: { id: "new_1", kind: "rectangle", text: "extra" },
        },
      ],
      options,
    );

    const existingIds = new Set(elements.map((element) => element.id));
    const lastElements = result.elements.slice(elements.length);

    expect(lastElements.length).toBeGreaterThan(0);
    for (const element of lastElements) {
      expect(existingIds.has(element.id)).toBe(false);
      expect(typeof element.index).toBe("string");
    }
  });
});
