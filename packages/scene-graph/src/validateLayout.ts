import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";

import { edgeLabelArrowId } from "./edgeLabels";
import { isSchemaDecoration } from "./schemaTable";

export type Box = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type Point = {
  x: number;
  y: number;
};

export type LayoutIssue = {
  type:
    | "node-overlap"
    | "node-label-overflow"
    | "edge-through-node"
    | "label-collision"
    | "label-on-edge"
    | "invalid-edge";
  ids: string[];
  message: string;
};

const COLLISION_MARGIN = 2;

export function validateDiagramLayout(
  elements: readonly ExcalidrawElement[],
): LayoutIssue[] {
  const live = elements.filter(
    (element) => !element.isDeleted && !isSchemaDecoration(element),
  );
  const shapes = live.filter(isShape);
  const arrows = live.filter((element) => element.type === "arrow");
  const texts = live.filter((element) => element.type === "text");
  const shapeIds = new Set(shapes.map((shape) => shape.id));
  const arrowIds = new Set(arrows.map((arrow) => arrow.id));
  const issues: LayoutIssue[] = [];

  for (let first = 0; first < shapes.length; first += 1) {
    for (let second = first + 1; second < shapes.length; second += 1) {
      const a = shapes[first];
      const b = shapes[second];

      if (a && b && boxesOverlap(boxOf(a), boxOf(b))) {
        issues.push({
          type: "node-overlap",
          ids: [a.id, b.id],
          message: "Two nodes overlap.",
        });
      }
    }
  }

  for (const text of texts) {
    if (text.containerId && shapeIds.has(text.containerId)) {
      const container = shapes.find((shape) => shape.id === text.containerId);

      if (container && !boxContains(boxOf(container), boxOf(text), 4)) {
        issues.push({
          type: "node-label-overflow",
          ids: [container.id, text.id],
          message: "A node label extends outside its shape.",
        });
      }
    }
  }

  const arrowSegmentsById = new Map<string, Array<{ a: Point; b: Point }>>();

  for (const arrow of arrows) {
    if (arrow.type !== "arrow") {
      continue;
    }

    const fromId = arrow.startBinding?.elementId;
    const toId = arrow.endBinding?.elementId;

    if (!fromId || !toId || !shapeIds.has(fromId) || !shapeIds.has(toId)) {
      issues.push({
        type: "invalid-edge",
        ids: [arrow.id],
        message: "An arrow has a missing or invalid endpoint.",
      });
      continue;
    }

    const segments = arrowSegments(arrow);
    arrowSegmentsById.set(arrow.id, segments);

    for (const shape of shapes) {
      if (shape.id === fromId || shape.id === toId) {
        continue;
      }

      if (
        segments.some((segment) =>
          segmentIntersectsBox(segment.a, segment.b, boxOf(shape), 0),
        )
      ) {
        issues.push({
          type: "edge-through-node",
          ids: [arrow.id, shape.id],
          message: "An arrow passes through an unrelated node.",
        });
      }
    }
  }

  const edgeLabels = texts.filter(
    (text) =>
      edgeLabelArrowId(text) !== undefined ||
      (text.containerId !== null && text.containerId !== undefined &&
        arrowIds.has(text.containerId)),
  );
  const edgeLabelIds = new Set(edgeLabels.map((label) => label.id));

  for (const label of edgeLabels) {
    const targetArrowId =
      edgeLabelArrowId(label) ?? label.containerId ?? undefined;

    if (!targetArrowId || !arrowIds.has(targetArrowId)) {
      issues.push({
        type: "invalid-edge",
        ids: [label.id],
        message: "An edge label is not attached to a valid arrow.",
      });
      continue;
    }

    const labelBox = boxOf(label);

    for (const shape of shapes) {
      if (boxesOverlap(labelBox, boxOf(shape), COLLISION_MARGIN)) {
        issues.push({
          type: "label-collision",
          ids: [label.id, shape.id],
          message: "An edge label overlaps a node.",
        });
        break;
      }
    }

    for (const other of texts) {
      if (other.id === label.id || !boxesOverlap(labelBox, boxOf(other), COLLISION_MARGIN)) {
        continue;
      }

      if (other.containerId && shapeIds.has(other.containerId)) {
        issues.push({
          type: "label-collision",
          ids: [label.id, other.id],
          message: "An edge label overlaps a node label.",
        });
      } else if (edgeLabelIds.has(other.id)) {
        issues.push({
          type: "label-collision",
          ids: [label.id, other.id],
          message: "Two edge labels overlap.",
        });
      }
    }

    for (const arrow of arrows) {
      if (arrow.id === targetArrowId || arrow.type !== "arrow") {
        continue;
      }

      const segments = arrowSegmentsById.get(arrow.id) ?? arrowSegments(arrow);

      if (
        segments.some((segment) =>
          segmentIntersectsBox(segment.a, segment.b, labelBox, 1),
        )
      ) {
        issues.push({
          type: "label-on-edge",
          ids: [label.id, arrow.id],
          message: "An edge label is crossed by another arrow.",
        });
        break;
      }
    }
  }

  return dedupeIssues(issues);
}

function isShape(
  element: ExcalidrawElement,
): element is ExcalidrawElement & Box {
  return (
    element.type === "rectangle" ||
    element.type === "ellipse" ||
    element.type === "diamond"
  );
}

function boxOf(element: {
  x: number;
  y: number;
  width: number;
  height: number;
}): Box {
  return {
    x: element.x,
    y: element.y,
    width: element.width,
    height: element.height,
  };
}

export function boxesOverlap(a: Box, b: Box, margin = 0): boolean {
  return (
    a.x < b.x + b.width + margin &&
    a.x + a.width + margin > b.x &&
    a.y < b.y + b.height + margin &&
    a.y + a.height + margin > b.y
  );
}

function boxContains(outer: Box, inner: Box, tolerance: number): boolean {
  return (
    inner.x >= outer.x - tolerance &&
    inner.y >= outer.y - tolerance &&
    inner.x + inner.width <= outer.x + outer.width + tolerance &&
    inner.y + inner.height <= outer.y + outer.height + tolerance
  );
}

function arrowSegments(element: ExcalidrawElement): Array<{
  a: Point;
  b: Point;
}> {
  if (element.type !== "arrow") {
    return [];
  }

  const points = element.points.map(([x, y]) => ({
    x: element.x + (x ?? 0),
    y: element.y + (y ?? 0),
  }));
  const segments: Array<{ a: Point; b: Point }> = [];

  for (let index = 0; index < points.length - 1; index += 1) {
    const a = points[index];
    const b = points[index + 1];

    if (a && b) {
      segments.push({ a, b });
    }
  }

  return segments;
}

export function segmentIntersectsBox(
  a: Point,
  b: Point,
  box: Box,
  margin: number,
): boolean {
  const left = box.x - margin;
  const right = box.x + box.width + margin;
  const top = box.y - margin;
  const bottom = box.y + box.height + margin;
  const inside = (point: Point) =>
    point.x >= left &&
    point.x <= right &&
    point.y >= top &&
    point.y <= bottom;

  if (inside(a) || inside(b)) {
    return true;
  }

  const corners = [
    { x: left, y: top },
    { x: right, y: top },
    { x: right, y: bottom },
    { x: left, y: bottom },
  ];

  for (let index = 0; index < corners.length; index += 1) {
    const current = corners[index];
    const next = corners[(index + 1) % corners.length];

    if (current && next && segmentsIntersect(a, b, current, next)) {
      return true;
    }
  }

  return false;
}

function segmentsIntersect(a: Point, b: Point, c: Point, d: Point): boolean {
  const orientation = (p: Point, q: Point, r: Point) =>
    (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
  const first = orientation(a, b, c);
  const second = orientation(a, b, d);
  const third = orientation(c, d, a);
  const fourth = orientation(c, d, b);
  const epsilon = 1e-6;
  const straddles = (left: number, right: number) =>
    (left > epsilon && right < -epsilon) ||
    (left < -epsilon && right > epsilon);

  return (
    straddles(first, second) &&
    straddles(third, fourth)
  );
}

function dedupeIssues(issues: LayoutIssue[]): LayoutIssue[] {
  const seen = new Set<string>();

  return issues.filter((issue) => {
    const key = `${issue.type}:${[...issue.ids].sort().join(":")}`;

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}
