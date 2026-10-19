import type { Graph, NewEdge, NewNode } from "@wb/shared-types";
import dagre from "dagre";

export type LayoutFunction = (
  graph: Graph,
  newNodes: NewNode[],
  newEdges: NewEdge[],
) => NewNode[];

const CHAR_WIDTH = 9;
const MIN_WIDTH = 120;
const MIN_HEIGHT = 60;
const MAX_WIDTH = 280;
const LINE_HEIGHT = 24;
const TEXT_PADDING = 16;
const GAP = 80;
const MARGIN = 20;
const STEP = 24;
const MAX_ATTEMPTS = 200;

type Size = { width: number; height: number };
type Rect = { x: number; y: number; width: number; height: number };

/** Rough size estimate: about 9px per character, wrapped to a max width. */
export function estimateNodeSize(node: NewNode): Size {
  const text = node.text ?? "";
  const lines = text.length === 0 ? [""] : text.split("\n");
  const longest = Math.max(...lines.map((line) => line.length));

  const width = Math.min(
    MAX_WIDTH,
    Math.max(MIN_WIDTH, longest * CHAR_WIDTH + TEXT_PADDING),
  );

  const charsPerLine = Math.max(
    1,
    Math.floor((width - TEXT_PADDING) / CHAR_WIDTH),
  );
  const wrappedLines = lines.reduce(
    (total, line) => total + Math.max(1, Math.ceil(line.length / charsPerLine)),
    0,
  );
  const height = Math.max(
    MIN_HEIGHT,
    wrappedLines * LINE_HEIGHT + TEXT_PADDING,
  );

  return { width, height };
}

/**
 * Fills in the missing geometry of new nodes so they never overlap the
 * existing ones. New nodes are anchored next to the nodes they connect to,
 * and unconnected ones go to the right of the current bounding box.
 */
export function placeNewNodes(
  graph: Graph,
  newNodes: NewNode[],
  newEdges: NewEdge[],
): NewNode[] {
  if (newNodes.length === 0) {
    return [];
  }

  const sizes = new Map<string, Size>();
  for (const node of newNodes) {
    const estimate = estimateNodeSize(node);
    sizes.set(node.id, {
      width: node.width ?? estimate.width,
      height: node.height ?? estimate.height,
    });
  }

  const dagrePositions = computeDagrePositions(
    graph,
    newNodes,
    newEdges,
    sizes,
  );
  const anchors = findAnchors(graph, newNodes, newEdges);

  const existingRects = graph.nodes.map((node) => ({
    x: node.x,
    y: node.y,
    width: node.width,
    height: node.height,
  }));
  const bounds = boundingBox(existingRects);

  const taken: Rect[] = [...existingRects];
  const result: NewNode[] = [];
  let isolatedCount = 0;

  for (const node of newNodes) {
    const size = sizes.get(node.id) ?? { width: MIN_WIDTH, height: MIN_HEIGHT };
    let x: number;
    let y: number;

    if (node.x !== undefined && node.y !== undefined) {
      x = node.x;
      y = node.y;
    } else {
      const anchorId = anchors.get(node.id);
      const anchor = anchorId
        ? graph.nodes.find((candidate) => candidate.id === anchorId)
        : undefined;
      const anchorPosition = anchorId
        ? dagrePositions.get(anchorId)
        : undefined;
      const nodePosition = dagrePositions.get(node.id);

      if (anchor && anchorPosition && nodePosition) {
        x = nodePosition.x + (anchor.x - anchorPosition.x);
        y = nodePosition.y + (anchor.y - anchorPosition.y);
      } else {
        x = bounds ? bounds.x + bounds.width + GAP : 0;
        y = bounds
          ? bounds.y + isolatedCount * (size.height + 40)
          : isolatedCount * (size.height + 40);
        isolatedCount += 1;
      }
    }

    const resolved = resolveOverlap({ x, y, ...size }, taken);
    taken.push(resolved);
    result.push({
      ...node,
      x: resolved.x,
      y: resolved.y,
      width: resolved.width,
      height: resolved.height,
    });
  }

  return result;
}

function computeDagrePositions(
  graph: Graph,
  newNodes: NewNode[],
  newEdges: NewEdge[],
  sizes: Map<string, Size>,
): Map<string, { x: number; y: number }> {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setGraph({ rankdir: "LR", nodesep: 60, ranksep: 100 });
  dagreGraph.setDefaultEdgeLabel(() => ({}));

  for (const node of graph.nodes) {
    dagreGraph.setNode(node.id, { width: node.width, height: node.height });
  }
  for (const node of newNodes) {
    const size = sizes.get(node.id) ?? { width: MIN_WIDTH, height: MIN_HEIGHT };
    dagreGraph.setNode(node.id, { width: size.width, height: size.height });
  }
  for (const edge of [...graph.edges, ...newEdges]) {
    if (dagreGraph.hasNode(edge.from) && dagreGraph.hasNode(edge.to)) {
      dagreGraph.setEdge(edge.from, edge.to);
    }
  }

  dagre.layout(dagreGraph);

  const positions = new Map<string, { x: number; y: number }>();
  for (const id of dagreGraph.nodes()) {
    const node = dagreGraph.node(id);
    positions.set(id, {
      x: node.x - node.width / 2,
      y: node.y - node.height / 2,
    });
  }

  return positions;
}

/** For every new node, the nearest existing node it connects to (through new nodes). */
function findAnchors(
  graph: Graph,
  newNodes: NewNode[],
  newEdges: NewEdge[],
): Map<string, string | undefined> {
  const existingIds = new Set(graph.nodes.map((node) => node.id));
  const newIds = new Set(newNodes.map((node) => node.id));
  const neighbours = new Map<string, string[]>();

  const link = (from: string, to: string) => {
    neighbours.set(from, [...(neighbours.get(from) ?? []), to]);
  };

  for (const edge of newEdges) {
    if (newIds.has(edge.from)) {
      link(edge.from, edge.to);
    }
    if (newIds.has(edge.to)) {
      link(edge.to, edge.from);
    }
  }

  const anchors = new Map<string, string | undefined>();

  for (const node of newNodes) {
    const visited = new Set<string>([node.id]);
    const queue = [node.id];
    let anchor: string | undefined;

    while (queue.length > 0 && anchor === undefined) {
      const current = queue.shift() as string;

      for (const neighbour of neighbours.get(current) ?? []) {
        if (existingIds.has(neighbour)) {
          anchor = neighbour;
          break;
        }
        if (newIds.has(neighbour) && !visited.has(neighbour)) {
          visited.add(neighbour);
          queue.push(neighbour);
        }
      }
    }

    anchors.set(node.id, anchor);
  }

  return anchors;
}

function resolveOverlap(rect: Rect, taken: Rect[]): Rect {
  let candidate = { ...rect };

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    if (!taken.some((other) => intersects(candidate, other))) {
      return candidate;
    }
    candidate = { ...candidate, x: candidate.x + STEP };
  }

  return candidate;
}

function intersects(a: Rect, b: Rect): boolean {
  return (
    a.x < b.x + b.width + MARGIN &&
    a.x + a.width + MARGIN > b.x &&
    a.y < b.y + b.height + MARGIN &&
    a.y + a.height + MARGIN > b.y
  );
}

function boundingBox(rects: Rect[]): Rect | null {
  if (rects.length === 0) {
    return null;
  }

  const minX = Math.min(...rects.map((rect) => rect.x));
  const minY = Math.min(...rects.map((rect) => rect.y));
  const maxX = Math.max(...rects.map((rect) => rect.x + rect.width));
  const maxY = Math.max(...rects.map((rect) => rect.y + rect.height));

  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}
