import type { Graph, Node, Op } from "@wb/shared-types";

const GRID = 20;
const MIN_WIDTH = 120;
const MIN_HEIGHT = 60;
const COLUMN_GAP = 80;
const ROW_GAP = 60;

type Geometry = { x: number; y: number; width: number; height: number };

const SHAPE_KINDS: ReadonlySet<Node["kind"]> = new Set([
  "rectangle",
  "ellipse",
  "diamond",
]);

export function tidy(graph: Graph): Op[] {
  const shapes = graph.nodes.filter(
    (node) =>
      SHAPE_KINDS.has(node.kind) &&
      !(node.fields && node.fields.length > 0),
  );

  if (shapes.length === 0) {
    return [];
  }

  const ranks = computeRanks(graph, shapes);
  const byRank = new Map<number, Node[]>();

  for (const node of shapes) {
    const rank = ranks.get(node.id) ?? 0;
    const list = byRank.get(rank);

    if (list) {
      list.push(node);
    } else {
      byRank.set(rank, [node]);
    }
  }

  const ops: Op[] = [];
  const rankOrder = [...byRank.keys()].sort((a, b) => a - b);
  const originX = snapDown(Math.min(...shapes.map((node) => node.x)));
  const originY = snapDown(Math.min(...shapes.map((node) => node.y)));
  let columnX = originX;

  for (const rank of rankOrder) {
    const nodes = [...(byRank.get(rank) ?? [])].sort(compareByPosition);
    const width = snapUp(
      Math.max(MIN_WIDTH, ...nodes.map((node) => node.width)),
    );
    const height = snapUp(
      Math.max(MIN_HEIGHT, ...nodes.map((node) => node.height)),
    );
    let rowY = originY;

    for (const node of nodes) {
      const patch = { x: columnX, y: rowY, width, height };

      if (hasChanged(node, patch)) {
        ops.push({ type: "update_node", id: node.id, patch });
      }

      rowY += height + ROW_GAP;
    }

    columnX += width + COLUMN_GAP;
  }

  return ops;
}

function computeRanks(graph: Graph, shapes: Node[]): Map<string, number> {
  const ids = new Set(shapes.map((node) => node.id));
  const edges = graph.edges.filter(
    (edge) => ids.has(edge.from) && ids.has(edge.to) && edge.from !== edge.to,
  );
  const ranks = new Map<string, number>(shapes.map((node) => [node.id, 0]));

  for (let pass = 0; pass < shapes.length; pass += 1) {
    let changed = false;

    for (const edge of edges) {
      const candidate = (ranks.get(edge.from) ?? 0) + 1;

      if (candidate > (ranks.get(edge.to) ?? 0) && candidate < shapes.length) {
        ranks.set(edge.to, candidate);
        changed = true;
      }
    }

    if (!changed) {
      break;
    }
  }

  return ranks;
}

function compareByPosition(a: Node, b: Node): number {
  if (a.y !== b.y) {
    return a.y - b.y;
  }

  if (a.x !== b.x) {
    return a.x - b.x;
  }

  return a.id.localeCompare(b.id);
}

function hasChanged(node: Node, patch: Geometry): boolean {
  return (
    node.x !== patch.x ||
    node.y !== patch.y ||
    node.width !== patch.width ||
    node.height !== patch.height
  );
}

function snapDown(value: number): number {
  return Math.floor(value / GRID) * GRID;
}

function snapUp(value: number): number {
  return Math.ceil(value / GRID) * GRID;
}
