import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import type { Op } from "@wb/shared-types";
import { placeNewNodes } from "@wb/layout";
import { describe, expect, it } from "vitest";

import { applyOps } from "../src/applyOps";
import { edgeLabelArrowId } from "../src/edgeLabels";
import agentOpsJson from "./fixtures/ai-agent-ops.json";

type Rect = { x: number; y: number; width: number; height: number };
type Point = { x: number; y: number };

const agentOps = agentOpsJson as Op[];
const edgeCount = agentOps.filter((op) => op.type === "add_edge").length;

function boxOf(element: ExcalidrawElement): Rect {
  return {
    x: element.x,
    y: element.y,
    width: element.width,
    height: element.height,
  };
}

function overlaps(a: Rect, b: Rect): boolean {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

function orientation(a: Point, b: Point, c: Point): number {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

function straddles(left: number, right: number): boolean {
  return (left > 1e-6 && right < -1e-6) || (left < -1e-6 && right > 1e-6);
}

function segmentsCross(a: Point, b: Point, c: Point, d: Point): boolean {
  return (
    straddles(orientation(a, b, c), orientation(a, b, d)) &&
    straddles(orientation(c, d, a), orientation(c, d, b))
  );
}

function rangeOverlap(
  aStart: number,
  aEnd: number,
  bStart: number,
  bEnd: number,
): boolean {
  const aMin = Math.min(aStart, aEnd);
  const aMax = Math.max(aStart, aEnd);
  const bMin = Math.min(bStart, bEnd);
  const bMax = Math.max(bStart, bEnd);

  return Math.min(aMax, bMax) - Math.max(aMin, bMin) > 8;
}

function segmentsOverlap(a: Point, b: Point, c: Point, d: Point): boolean {
  const epsilon = 2;
  const lane = 6;

  if (
    Math.abs(a.y - b.y) <= epsilon &&
    Math.abs(c.y - d.y) <= epsilon &&
    Math.abs(a.y - c.y) <= lane
  ) {
    return rangeOverlap(a.x, b.x, c.x, d.x);
  }

  if (
    Math.abs(a.x - b.x) <= epsilon &&
    Math.abs(c.x - d.x) <= epsilon &&
    Math.abs(a.x - c.x) <= lane
  ) {
    return rangeOverlap(a.y, b.y, c.y, d.y);
  }

  return false;
}

function segmentHitsBox(a: Point, b: Point, box: Rect): boolean {
  const corners = [
    { x: box.x, y: box.y },
    { x: box.x + box.width, y: box.y },
    { x: box.x + box.width, y: box.y + box.height },
    { x: box.x, y: box.y + box.height },
  ];
  const inside = (point: Point) =>
    point.x > box.x &&
    point.x < box.x + box.width &&
    point.y > box.y &&
    point.y < box.y + box.height;

  if (inside(a) || inside(b)) {
    return true;
  }

  for (let index = 0; index < 4; index += 1) {
    const current = corners[index];
    const next = corners[(index + 1) % 4];
    if (current && next && segmentsCross(a, b, current, next)) {
      return true;
    }
  }

  return false;
}

describe("AI agent diagram regression", () => {
  it("keeps branches and the tool-result loop readable", () => {
    const result = applyOps([], agentOps, { layout: placeNewNodes });
    const shapes = result.elements.filter(
      (element) =>
        element.type === "rectangle" ||
        element.type === "ellipse" ||
        element.type === "diamond",
    );
    const arrows = result.elements.filter(
      (element) => element.type === "arrow",
    );
    const arrowIds = new Set(arrows.map((arrow) => arrow.id));
    const labels = result.elements.filter((element) => {
      const labelFor = edgeLabelArrowId(element);

      return (
        element.type === "text" &&
        ((labelFor !== undefined && arrowIds.has(labelFor)) ||
          (element.containerId !== null && arrowIds.has(element.containerId)))
      );
    });

    expect(result.skipped).toEqual([]);
    expect(shapes).toHaveLength(10);
    expect(arrows).toHaveLength(edgeCount);
    expect(labels).toHaveLength(edgeCount);

    const shapeBoxes = shapes.map(boxOf);
    const labelBoxes = labels.map(boxOf);

    let shapeOverlaps = 0;
    for (let i = 0; i < shapeBoxes.length; i += 1) {
      for (let j = i + 1; j < shapeBoxes.length; j += 1) {
        const a = shapeBoxes[i];
        const b = shapeBoxes[j];
        if (a && b && overlaps(a, b)) {
          shapeOverlaps += 1;
        }
      }
    }

    let labelShapeOverlaps = 0;
    for (const label of labelBoxes) {
      for (const shape of shapeBoxes) {
        if (overlaps(label, shape)) {
          labelShapeOverlaps += 1;
        }
      }
    }

    let labelLabelOverlaps = 0;
    for (let i = 0; i < labelBoxes.length; i += 1) {
      for (let j = i + 1; j < labelBoxes.length; j += 1) {
        const a = labelBoxes[i];
        const b = labelBoxes[j];
        if (a && b && overlaps(a, b)) {
          labelLabelOverlaps += 1;
        }
      }
    }

    const segments = arrows.flatMap((arrow) => {
      if (arrow.type !== "arrow") {
        return [];
      }
      const points = arrow.points.map(
        ([x, y]): Point => ({ x: arrow.x + x, y: arrow.y + y }),
      );
      return points.slice(0, -1).map((point, index) => ({
        a: point,
        b: points[index + 1] as Point,
        arrowId: arrow.id,
        from: arrow.startBinding?.elementId,
        to: arrow.endBinding?.elementId,
      }));
    });

    let edgeThroughNodes = 0;
    for (const segment of segments) {
      for (const shape of shapes) {
        if (shape.id === segment.from || shape.id === segment.to) {
          continue;
        }
        if (segmentHitsBox(segment.a, segment.b, boxOf(shape))) {
          edgeThroughNodes += 1;
        }
      }
    }

    let crossings = 0;
    for (let i = 0; i < segments.length; i += 1) {
      for (let j = i + 1; j < segments.length; j += 1) {
        const a = segments[i];
        const b = segments[j];
        if (
          a &&
          b &&
          a.arrowId !== b.arrowId &&
          segmentsCross(a.a, a.b, b.a, b.b)
        ) {
          crossings += 1;
        }
      }
    }

    let corridorOverlaps = 0;
    for (let i = 0; i < segments.length; i += 1) {
      for (let j = i + 1; j < segments.length; j += 1) {
        const a = segments[i];
        const b = segments[j];
        if (
          a &&
          b &&
          a.arrowId !== b.arrowId &&
          segmentsOverlap(a.a, a.b, b.a, b.b)
        ) {
          corridorOverlaps += 1;
        }
      }
    }

    let labelArrowOverlaps = 0;
    for (const label of labelBoxes) {
      for (const segment of segments) {
        if (segmentHitsBox(segment.a, segment.b, label)) {
          labelArrowOverlaps += 1;
        }
      }
    }

    const nodeId = (fragment: string) => {
      const op = agentOps.find(
        (candidate) =>
          candidate.type === "add_node" &&
          candidate.node.text?.includes(fragment),
      );
      return op?.type === "add_node" ? result.idMap.get(op.node.id) : undefined;
    };
    const arrowBetween = (from: string, to: string) => {
      const fromId = nodeId(from);
      const toId = nodeId(to);
      return arrows.find(
        (arrow) =>
          arrow.type === "arrow" &&
          arrow.startBinding?.elementId === fromId &&
          arrow.endBinding?.elementId === toId,
      );
    };

    const resultReturn = arrowBetween("Tool result", "AI agent");
    const retryReturn = arrowBetween(
      "Retry transient failure",
      "Call tool",
    );
    expect(resultReturn?.type).toBe("arrow");
    expect(retryReturn?.type).toBe("arrow");
    expect(
      resultReturn?.type === "arrow" ? resultReturn.points.length : 0,
    ).toBeGreaterThan(2);

    const crossCount = (one?: string, two?: string) => {
      let count = 0;
      for (const first of segments) {
        for (const second of segments) {
          if (
            first.arrowId === one &&
            second.arrowId === two &&
            segmentsCross(first.a, first.b, second.a, second.b)
          ) {
            count += 1;
          }
        }
      }
      return count;
    };
    const noTool = arrowBetween("Need a tool?", "Final response");
    const toolArrows = [
      arrowBetween("Call tool", "Tool result"),
      arrowBetween("Call tool", "Handle failure"),
      arrowBetween("Handle failure", "Retry transient failure"),
      arrowBetween("Retry transient failure", "Call tool"),
    ];
    expect(noTool?.type).toBe("arrow");
    const directToolCrossings = toolArrows.reduce(
      (total, arrow) => total + (arrow ? crossCount(noTool?.id, arrow.id) : 0),
      0,
    );
    expect(directToolCrossings).toBe(0);

    const sceneBounds = {
      left: Math.min(...shapes.map((element) => element.x)),
      top: Math.min(...shapes.map((element) => element.y)),
      right: Math.max(...shapes.map((element) => element.x + element.width)),
      bottom: Math.max(...shapes.map((element) => element.y + element.height)),
    };
    const isOutside = (arrow: ExcalidrawElement) => {
      if (arrow.type !== "arrow") {
        return false;
      }
      return arrow.points.some(
        ([x, y]) =>
          arrow.x + x < sceneBounds.left ||
          arrow.x + x > sceneBounds.right ||
          arrow.y + y < sceneBounds.top ||
          arrow.y + y > sceneBounds.bottom,
      );
    };
    expect(isOutside(resultReturn as ExcalidrawElement)).toBe(true);

    expect(shapeOverlaps).toBe(0);
    expect(labelShapeOverlaps).toBe(0);
    expect(labelLabelOverlaps).toBe(0);
    expect(edgeThroughNodes).toBe(0);
    expect(labelArrowOverlaps).toBe(0);
    expect(corridorOverlaps).toBe(0);
    expect(crossings).toBeLessThanOrEqual(2);

    const width = sceneBounds.right - sceneBounds.left;
    const height = sceneBounds.bottom - sceneBounds.top;
    expect(width / height).toBeGreaterThan(0.8);
    expect(width / height).toBeLessThan(2.8);
  });
});
