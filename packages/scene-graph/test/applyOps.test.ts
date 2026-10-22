import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import type { Op } from "@wb/shared-types";
import { placeNewNodes } from "@wb/layout";
import { describe, expect, it } from "vitest";

import { applyOps } from "../src/applyOps";
import { edgeLabelArrowId } from "../src/edgeLabels";
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

type Rect = { x: number; y: number; width: number; height: number };

function overlaps(a: Rect, b: Rect): boolean {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

function segmentHitsBox(
  from: { x: number; y: number },
  to: { x: number; y: number },
  box: Rect,
): boolean {
  const corners = [
    { x: box.x, y: box.y },
    { x: box.x + box.width, y: box.y },
    { x: box.x + box.width, y: box.y + box.height },
    { x: box.x, y: box.y + box.height },
  ];
  const orientation = (
    a: { x: number; y: number },
    b: { x: number; y: number },
    c: { x: number; y: number },
  ) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  const straddles = (left: number, right: number) =>
    (left > 1e-6 && right < -1e-6) || (left < -1e-6 && right > 1e-6);

  for (let index = 0; index < corners.length; index += 1) {
    const current = corners[index];
    const next = corners[(index + 1) % corners.length];

    if (!current || !next) {
      continue;
    }

    if (
      straddles(orientation(from, to, current), orientation(from, to, next)) &&
      straddles(orientation(current, next, from), orientation(current, next, to))
    ) {
      return true;
    }
  }

  return false;
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

  it("does not detour arrows around edge labels", () => {
    const root = rectangle("root", 200, 0, 160, 60);
    const first = rectangle("a", 0, 220, 120, 60);
    const second = rectangle("b", 400, 220, 120, 60);

    const result = applyOps(
      [root, first, second],
      [
        {
          type: "add_edge",
          edge: { id: "e1", from: "root", to: "a", label: "includes" },
        },
        {
          type: "add_edge",
          edge: { id: "e2", from: "root", to: "b", label: "includes" },
        },
      ],
      options,
    );

    const arrows = result.elements.filter((element) => element.type === "arrow");

    expect(arrows).toHaveLength(2);
    for (const arrow of arrows) {
      if (arrow.type === "arrow") {
        expect(arrow.points.length).toBeLessThanOrEqual(3);
        for (let index = 0; index < arrow.points.length - 1; index += 1) {
          const from = arrow.points[index];
          const to = arrow.points[index + 1];
          if (!from || !to) {
            continue;
          }
          expect(
            Math.abs(from[0] - to[0]) < 1 || Math.abs(from[1] - to[1]) < 1,
          ).toBe(true);
        }
      }
    }
  });

  it("places edge labels clear of the shapes on short edges", () => {
    const first = rectangle("a", 0, 0, 120, 60);
    const second = rectangle("b", 200, 0, 120, 60);

    const result = applyOps(
      [first, second],
      [
        {
          type: "add_edge",
          edge: {
            id: "e",
            from: "a",
            to: "b",
            label: "authenticated access",
          },
        },
      ],
      options,
    );

    const arrowId = result.idMap.get("e");
    const label = result.elements.find(
      (element) =>
        element.type === "text" &&
        arrowId !== undefined &&
        edgeLabelArrowId(element) === arrowId,
    );

    expect(label).toBeDefined();

    const box = {
      x: label?.x ?? 0,
      y: label?.y ?? 0,
      width: label?.width ?? 0,
      height: label?.height ?? 0,
    };

    for (const shape of [first, second]) {
      const intersects =
        box.x < shape.x + shape.width &&
        box.x + box.width > shape.x &&
        box.y < shape.y + shape.height &&
        box.y + box.height > shape.y;

      expect(intersects).toBe(false);
    }
  });

  it("routes arrows around unrelated shapes", () => {
    const first = rectangle("a", 0, 0);
    const second = rectangle("b", 500, 0);
    const blocker = rectangle("blocker", 240, -60, 100, 180);

    const result = applyOps(
      [first, second, blocker],
      [{ type: "add_edge", edge: { id: "e", from: "a", to: "b" } }],
      options,
    );

    const arrow = result.elements.find((element) => element.type === "arrow");

    if (!arrow || arrow.type !== "arrow") {
      throw new Error("expected an arrow");
    }

    expect(arrow.points.length).toBeGreaterThan(2);

    const scenePoints = arrow.points.map(([x, y]) => ({
      x: arrow.x + (x ?? 0),
      y: arrow.y + (y ?? 0),
    }));

    for (let index = 0; index < scenePoints.length - 1; index += 1) {
      const from = scenePoints[index];
      const to = scenePoints[index + 1];

      if (!from || !to) {
        continue;
      }

      expect(segmentHitsBox(from, to, blocker)).toBe(false);
    }
  });

  it("keeps edge labels clear of each other", () => {
    const first = rectangle("a", 0, 0);
    const right = rectangle("b", 320, 0);
    const below = rectangle("c", 0, 260);

    const result = applyOps(
      [first, right, below],
      [
        {
          type: "add_edge",
          edge: { id: "e1", from: "a", to: "b", label: "opens" },
        },
        {
          type: "add_edge",
          edge: { id: "e2", from: "a", to: "c", label: "sends details" },
        },
      ],
      options,
    );

    const firstArrowId = result.idMap.get("e1");
    const secondArrowId = result.idMap.get("e2");
    const labels = result.elements.filter((element) => {
      const labelFor = edgeLabelArrowId(element);

      return (
        element.type === "text" &&
        labelFor !== undefined &&
        (labelFor === firstArrowId || labelFor === secondArrowId)
      );
    });

    expect(labels).toHaveLength(2);

    const [one, two] = labels;

    if (!one || !two) {
      throw new Error("expected two edge labels");
    }

    const intersects =
      one.x < two.x + two.width &&
      one.x + one.width > two.x &&
      one.y < two.y + two.height &&
      one.y + one.height > two.y;

    expect(intersects).toBe(false);
  });

  it("keeps short same-row reverse edges straight", () => {
    const first = rectangle("a", 0, 0);
    const second = rectangle("b", 300, 0);

    const result = applyOps(
      [first, second],
      [{ type: "add_edge", edge: { id: "e", from: "b", to: "a" } }],
      options,
    );

    const arrow = result.elements.find((element) => element.type === "arrow");

    if (!arrow || arrow.type !== "arrow") {
      throw new Error("expected an arrow");
    }

    expect(arrow.points).toHaveLength(2);
  });

  it("keeps a wide diagonal fan-out on a direct orthogonal route", () => {
    const root = rectangle("root", 425, 0, 250, 60);
    const target = rectangle("leaf", 0, 190, 120, 60);

    const result = applyOps(
      [root, target],
      [{ type: "add_edge", edge: { id: "e", from: "root", to: "leaf" } }],
      options,
    );

    const arrow = result.elements.find((element) => element.type === "arrow");

    if (!arrow || arrow.type !== "arrow") {
      throw new Error("expected an arrow");
    }

    expect(arrow.points).toHaveLength(3);
    const [first, second, third] = arrow.points;
    expect(
      first && second && third &&
        (Math.abs(first[0] - second[0]) < 1 ||
          Math.abs(first[1] - second[1]) < 1) &&
        (Math.abs(second[0] - third[0]) < 1 ||
          Math.abs(second[1] - third[1]) < 1),
    ).toBe(true);
  });

  it("routes backward edges around the flow", () => {
    const first = rectangle("a", 0, 0);
    const second = rectangle("b", 300, 0);
    const third = rectangle("c", 600, 0);

    const result = applyOps(
      [first, second, third],
      [
        { type: "add_edge", edge: { id: "e1", from: "a", to: "b" } },
        { type: "add_edge", edge: { id: "e2", from: "b", to: "c" } },
        { type: "add_edge", edge: { id: "retry", from: "c", to: "a" } },
      ],
      options,
    );

    const arrows = result.elements.filter((element) => element.type === "arrow");
    const back = arrows.find(
      (arrow) =>
        arrow.type === "arrow" &&
        arrow.startBinding?.elementId === "c" &&
        arrow.endBinding?.elementId === "a",
    );

    if (!back || back.type !== "arrow") {
      throw new Error("expected a backward arrow");
    }

    expect(back.points.length).toBeGreaterThanOrEqual(3);

    const sceneYs = back.points.map(
      ([, y]) => back.y + (y ?? 0),
    );
    const top = Math.min(first.y, second.y, third.y);
    const bottom = Math.max(
      first.y + first.height,
      second.y + second.height,
      third.y + third.height,
    );

    expect(Math.max(...sceneYs) > bottom || Math.min(...sceneYs) < top).toBe(
      true,
    );
  });

  it("starts and ends arrows at the shape borders", () => {
    const first = rectangle("a", 0, 0, 120, 60);
    const second = rectangle("b", 400, 0, 120, 60);

    const result = applyOps(
      [first, second],
      [{ type: "add_edge", edge: { id: "e", from: "a", to: "b" } }],
      options,
    );

    const arrow = result.elements.find((element) => element.type === "arrow");

    if (!arrow || arrow.type !== "arrow") {
      throw new Error("expected an arrow");
    }

    expect(arrow.x).toBe(120);
    expect(arrow.y).toBe(30);
    expect(arrow.points).toEqual([
      [0, 0],
      [280, 0],
    ]);
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
