import type { Graph, NewEdge, NewNode } from "@wb/shared-types";
import dagre from "dagre";

import { estimateSchemaTable } from "./schema";
import {
  NODE_FONT_SIZE,
  NODE_LINE_HEIGHT_RATIO,
  NODE_TEXT_PADDING,
  TEXT_WIDTH_RATIO,
  wrapNodeText,
} from "./text";

export { tidy } from "./tidy";
export {
  SCHEMA_BOTTOM_PADDING,
  SCHEMA_FIELD_FONT_SIZE,
  SCHEMA_FIELD_TOP,
  SCHEMA_HEADER_FONT_SIZE,
  SCHEMA_HEADER_HEIGHT,
  SCHEMA_MIN_WIDTH,
  SCHEMA_PADDING_X,
  SCHEMA_ROW_HEIGHT,
  estimateSchemaTable,
  formatCardinality,
  schemaFieldLines,
  schemaRowCenterY,
  type SchemaTableMetrics,
} from "./schema";
export {
  EDGE_FONT_SIZE,
  EDGE_LINE_HEIGHT_RATIO,
  MAX_EDGE_LABEL_WIDTH,
  NODE_FONT_SIZE,
  NODE_LINE_HEIGHT_RATIO,
  NODE_TEXT_PADDING,
  TEXT_WIDTH_RATIO,
  wrapEdgeText,
  wrapNodeText,
  wrapText,
  type WrappedText,
} from "./text";

export type LayoutFunction = (
  graph: Graph,
  newNodes: NewNode[],
  newEdges: NewEdge[],
) => NewNode[];

export type LayoutKind =
  | "sequence"
  | "flowchart"
  | "tree"
  | "architecture"
  | "mindmap"
  | "schema";

const LAYOUT_HINTS: ReadonlyArray<readonly [LayoutKind, RegExp]> = [
  ["mindmap", /\b(mind\s?map|concept map|ideas? around|map of)\b/i],
  [
    "tree",
    /\b(tree|hierarchy|hierarchical|break\s?down|categories?|components)\b/i,
  ],
  [
    "flowchart",
    /\b(flow\s?chart|workflow|what happens when|succeeds? or fails?|success or failure|decision)\b/i,
  ],
  [
    "architecture",
    /\b(architecture|system design|systems?|under the hood|internals?|implementation|production[- ]ready|backend|layers?|services|infrastructure|stack|platform|distributed|scalab\w*)\b/i,
  ],
];

/** Explicit layout requested by the prompt, if one is obvious. */
export function chooseLayoutType(instruction: string): LayoutKind | undefined {
  for (const [kind, pattern] of LAYOUT_HINTS) {
    if (pattern.test(instruction)) {
      return kind;
    }
  }

  return undefined;
}

export function layoutWithKind(kind: LayoutKind): LayoutFunction {
  return (graph, newNodes, newEdges) =>
    placeNewNodes(graph, newNodes, newEdges, { kind });
}

const CHAR_WIDTH = NODE_FONT_SIZE * TEXT_WIDTH_RATIO;
const MIN_WIDTH = 120;
const MIN_HEIGHT = 60;
const MAX_WIDTH = 280;
const LINE_HEIGHT = NODE_FONT_SIZE * NODE_LINE_HEIGHT_RATIO;
const TEXT_PADDING = NODE_TEXT_PADDING;
const GAP = 80;
const MARGIN = 20;
const STEP = 24;
const MAX_ATTEMPTS = 200;

type Size = { width: number; height: number };
type Rect = { x: number; y: number; width: number; height: number };

/** Rough size estimate: about 9px per character, wrapped to a max width. */
export function estimateNodeSize(node: NewNode): Size {
  if (node.fields && node.fields.length > 0) {
    const table = estimateSchemaTable(node.text ?? "table", node.fields);

    return { width: table.width, height: table.height };
  }

  const text = node.text ?? "";
  const lines = text.length === 0 ? [""] : text.split("\n");
  const longest = Math.max(...lines.map((line) => line.length));

  const width = Math.min(
    MAX_WIDTH,
    Math.max(MIN_WIDTH, longest * CHAR_WIDTH + TEXT_PADDING),
  );
  const wrapped = wrapNodeText(text, width);
  const height = Math.max(
    MIN_HEIGHT,
    wrapped.lines.length * LINE_HEIGHT + TEXT_PADDING,
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
  options: { kind?: LayoutKind } = {},
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

  const kind = options.kind ?? inferLayoutType(combinedGraph(graph, newNodes, newEdges));
  const mindmap =
    kind === "mindmap" && graph.nodes.length === 0
      ? computeMindmapPositions(newNodes, newEdges, sizes)
      : null;

  const dagrePositions =
    mindmap ??
    computeDagrePositions(graph, newNodes, newEdges, sizes, kind);  const anchors = findAnchors(graph, newNodes, newEdges);

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
      } else if (!bounds && nodePosition) {
        x = nodePosition.x;
        y = nodePosition.y;
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
  kind: LayoutKind,
): Map<string, { x: number; y: number }> {
  const wrapRanks =
    graph.nodes.length === 0 &&
    ((kind === "flowchart" && newNodes.length >= 6) ||
      (kind === "architecture" && newNodes.length >= 7));

  if (wrapRanks) {
    const ranks = computeRanks(newNodes, newEdges);
    const groups = new Map<number, number>();

    for (const node of newNodes) {
      const rank = ranks.get(node.id) ?? 0;
      groups.set(rank, (groups.get(rank) ?? 0) + 1);
    }

    const maxRankSize = Math.max(...groups.values());
    const edgeAllowance =
      kind === "architecture" ? newNodes.length * 3 : newNodes.length * 2;
    const rankLimit = kind === "architecture" ? 4 : 3;
    const mostlyLinear =
      newEdges.length <= edgeAllowance && maxRankSize <= rankLimit;

    if (mostlyLinear) {
      const backEdges = countBackEdges(newNodes, newEdges);
      const wrapped = computeWrappedRankPositions(
        newNodes,
        newEdges,
        sizes,
        backEdges >= 2,
      );

      if (wrapped) {
        return wrapped;
      }
    }
  }

  const config = layoutConfig(kind);

  if (config.wrap) {
    const wrapped = computeWrappedChainPositions(newNodes, newEdges, sizes);

    if (graph.nodes.length === 0 && wrapped) {
      return wrapped;
    }
  }

  if (kind === "architecture" && graph.nodes.length === 0) {
    const wrapped = computeRankWrappedPositions(newNodes, newEdges, sizes);

    if (wrapped) {
      return wrapped;
    }
  }

  const build = (rankdir: "LR" | "TB") => {
    const dagreGraph = new dagre.graphlib.Graph({ multigraph: true });
    dagreGraph.setGraph({
      rankdir,
      nodesep: config.nodesep,
      ranksep: config.ranksep,
    });
    dagreGraph.setDefaultEdgeLabel(() => ({}));

    for (const node of graph.nodes) {
      dagreGraph.setNode(node.id, { width: node.width, height: node.height });
    }
    for (const node of newNodes) {
      const size = sizes.get(node.id) ?? { width: MIN_WIDTH, height: MIN_HEIGHT };
      dagreGraph.setNode(node.id, { width: size.width, height: size.height });
    }
    for (const edge of [...graph.edges, ...newEdges]) {
      if (!dagreGraph.hasNode(edge.from) || !dagreGraph.hasNode(edge.to)) {
        continue;
      }

      const label = edge.label
        ? {
            width: Math.max(30, edge.label.length * 7 + 8),
            height: 18,
            labelpos: "c" as const,
          }
        : {};

      dagreGraph.setEdge(edge.from, edge.to, label, edge.id);
    }

    dagre.layout(dagreGraph);

    return dagreGraph;
  };

  const architectureBranching =
    kind === "architecture" &&
    graph.nodes.length === 0 &&
    orderedByRank(newNodes, newEdges) === null;

  let chosen;

  if (config.rankdir) {
    if (architectureBranching && newNodes.length >= 9) {
      const horizontal = build("LR");
      const vertical = build("TB");
      const fitScore = (layout: dagre.graphlib.Graph) => {
        const box = graphBounds(layout);

        return Math.min(
          NOMINAL_CANVAS.width / Math.max(1, box.width),
          NOMINAL_CANVAS.height / Math.max(1, box.height),
        );
      };

      chosen = fitScore(horizontal) > fitScore(vertical) ? horizontal : vertical;
    } else if (architectureBranching) {
      chosen = build("TB");
    } else {
      chosen = build(config.rankdir);
    }
  } else {
    const horizontal = build("LR");
    const vertical = build("TB");
    const horizontalBox = graphBounds(horizontal);
    const verticalBox = graphBounds(vertical);
    const horizontalScore = horizontalBox.width - horizontalBox.height;
    const verticalScore = verticalBox.width - verticalBox.height;
    chosen = horizontalScore >= verticalScore ? horizontal : vertical;
  }

  const positions = new Map<string, { x: number; y: number }>();
  for (const id of chosen.nodes()) {
    const node = chosen.node(id);
    positions.set(id, {
      x: node.x - node.width / 2,
      y: node.y - node.height / 2,
    });
  }

  return positions;
}

function layoutConfig(kind: LayoutKind): {
  rankdir: "LR" | "TB" | null;
  nodesep: number;
  ranksep: number;
  wrap: boolean;
} {
  switch (kind) {
    case "tree":
      return { rankdir: "TB", nodesep: 60, ranksep: 110, wrap: false };
    case "flowchart":
      return { rankdir: "TB", nodesep: 80, ranksep: 120, wrap: false };
    case "architecture":
      return { rankdir: "LR", nodesep: 60, ranksep: 140, wrap: false };
    case "schema":
      return { rankdir: "LR", nodesep: 100, ranksep: 180, wrap: false };
    case "mindmap":
    case "sequence":
      return { rankdir: null, nodesep: 50, ranksep: 90, wrap: true };
  }
}

function combinedGraph(
  graph: Graph,
  newNodes: NewNode[],
  newEdges: NewEdge[],
): Graph {
  return {
    nodes: [
      ...graph.nodes,
      ...newNodes.map((node) => ({
        id: node.id,
        kind: node.kind,
        ...(node.text === undefined ? {} : { text: node.text }),
        x: node.x ?? 0,
        y: node.y ?? 0,
        width: node.width ?? MIN_WIDTH,
        height: node.height ?? MIN_HEIGHT,
      })),
    ],
    edges: [...graph.edges, ...newEdges],
  };
}

/** Structural layout choice when the prompt does not request a specific one. */
export function inferLayoutType(graph: Graph): LayoutKind {
  const ids = new Set(graph.nodes.map((node) => node.id));

  if (ids.size === 0) {
    return "sequence";
  }

  const edges = graph.edges.filter(
    (edge) => ids.has(edge.from) && ids.has(edge.to),
  );
  const inDegree = new Map<string, number>(
    graph.nodes.map((node) => [node.id, 0]),
  );
  const outDegree = new Map<string, number>(
    graph.nodes.map((node) => [node.id, 0]),
  );
  const adjacency = new Map<string, string[]>();

  for (const edge of edges) {
    inDegree.set(edge.to, (inDegree.get(edge.to) ?? 0) + 1);
    outDegree.set(edge.from, (outDegree.get(edge.from) ?? 0) + 1);
    adjacency.set(edge.from, [...(adjacency.get(edge.from) ?? []), edge.to]);
  }

  const chain = orderedGraphChain(graph.nodes, adjacency, inDegree);

  if (chain) {
    return "sequence";
  }

  const hasDecision = graph.nodes.some(
    (node) =>
      node.kind === "diamond" && (outDegree.get(node.id) ?? 0) >= 2,
  );
  const hasMerge = graph.nodes.some(
    (node) => (inDegree.get(node.id) ?? 0) >= 2,
  );

  if (hasDecision || hasMerge) {
    return "flowchart";
  }

  const roots = graph.nodes.filter(
    (node) => (inDegree.get(node.id) ?? 0) === 0,
  );

  return roots.length === 1 ? "tree" : "architecture";
}

function orderedGraphChain(
  nodes: Graph["nodes"],
  adjacency: Map<string, string[]>,
  inDegree: Map<string, number>,
): string[] | null {
  const roots = nodes.filter(
    (node) => (inDegree.get(node.id) ?? 0) === 0,
  );

  if (roots.length !== 1) {
    return null;
  }

  const chain: string[] = [];
  const seen = new Set<string>();
  let current: string | undefined = roots[0]?.id;

  while (current) {
    if (seen.has(current)) {
      return null;
    }

    seen.add(current);
    chain.push(current);

    const next = adjacency.get(current) ?? [];

    if (next.length > 1) {
      return null;
    }

    current = next[0];
  }

  return chain.length === nodes.length ? chain : null;
}

/**
 * Central topic with related ideas around it (root at the origin). Only used
 * for two-level mind maps; deeper graphs fall back to the tree layout.
 */
function computeMindmapPositions(
  newNodes: NewNode[],
  newEdges: NewEdge[],
  sizes: Map<string, Size>,
): Map<string, { x: number; y: number }> | null {
  const ids = new Set(newNodes.map((node) => node.id));
  const adjacency = new Map<string, string[]>();
  const inDegree = new Map<string, number>(
    newNodes.map((node) => [node.id, 0]),
  );

  for (const edge of newEdges) {
    if (!ids.has(edge.from) || !ids.has(edge.to) || edge.from === edge.to) {
      continue;
    }

    adjacency.set(edge.from, [...(adjacency.get(edge.from) ?? []), edge.to]);
    inDegree.set(edge.to, (inDegree.get(edge.to) ?? 0) + 1);
  }

  const roots = newNodes.filter((node) => (inDegree.get(node.id) ?? 0) === 0);

  if (roots.length !== 1 || !roots[0]) {
    return null;
  }

  const rootId = roots[0].id;
  const children = adjacency.get(rootId) ?? [];

  if (children.length < 2) {
    return null;
  }

  const grandchildren = children.flatMap((id) => adjacency.get(id) ?? []);

  if (grandchildren.some((id) => (adjacency.get(id) ?? []).length > 0)) {
    return null;
  }

  if (1 + children.length + grandchildren.length !== newNodes.length) {
    return null;
  }

  const sizeOf = (id: string) =>
    sizes.get(id) ?? { width: MIN_WIDTH, height: MIN_HEIGHT };
  const gap = 40;
  const circumference = children.reduce(
    (total, id) => total + sizeOf(id).width + gap,
    0,
  );
  const radius = Math.max(320, circumference / (2 * Math.PI));
  const positions = new Map<string, { x: number; y: number }>();
  const rootSize = sizeOf(rootId);

  positions.set(rootId, {
    x: -rootSize.width / 2,
    y: -rootSize.height / 2,
  });

  children.forEach((id, index) => {
    const angle = -Math.PI / 2 + (index * 2 * Math.PI) / children.length;
    const size = sizeOf(id);

    positions.set(id, {
      x: Math.cos(angle) * radius - size.width / 2,
      y: Math.sin(angle) * radius - size.height / 2,
    });

    const kids = adjacency.get(id) ?? [];

    kids.forEach((kid, kidIndex) => {
      const offset =
        kids.length === 1
          ? 0
          : ((kidIndex / (kids.length - 1)) - 0.5) * 0.7;
      const kidAngle = angle + offset;
      const kidRadius = radius + 200;
      const kidSize = sizeOf(kid);

      positions.set(kid, {
        x: Math.cos(kidAngle) * kidRadius - kidSize.width / 2,
        y: Math.sin(kidAngle) * kidRadius - kidSize.height / 2,
      });
    });
  });

  return positions;
}

const WRAP_MIN_CHAIN = 5;
const WRAP_RANKS_PER_ROW = 3;
const WRAP_COLUMN_GAP = 80;
const WRAP_ROW_GAP = 90;
const RANK_NODE_GAP = 30;
const TARGET_ASPECT = 1.6;
const NOMINAL_CANVAS = { width: 1440, height: 900 };

type RankBlock = { ids: string[]; width: number; height: number };

function countBackEdges(
  newNodes: NewNode[],
  newEdges: NewEdge[],
): number {
  const adjacency = new Map<string, Array<{ to: string; id: string }>>();

  for (const node of newNodes) {
    adjacency.set(node.id, []);
  }

  for (const edge of newEdges) {
    adjacency.get(edge.from)?.push({ to: edge.to, id: edge.id });
  }

  const state = new Map<string, 0 | 1 | 2>();
  const back = new Set<string>();

  const visit = (node: string): void => {
    state.set(node, 1);

    for (const next of adjacency.get(node) ?? []) {
      const status = state.get(next.to) ?? 0;

      if (status === 1) {
        back.add(next.id);
      } else if (status === 0 && adjacency.has(next.to)) {
        visit(next.to);
      }
    }

    state.set(node, 2);
  };

  for (const node of newNodes) {
    if ((state.get(node.id) ?? 0) === 0) {
      visit(node.id);
    }
  }

  return back.size;
}

/**
 * Wraps arbitrary ranked graphs into a centered grid of rank blocks so a tall
 * decision flow does not become a narrow vertical column. Rows alternate
 * direction (snake) to keep consecutive ranks adjacent.
 */
function computeWrappedRankPositions(
  newNodes: NewNode[],
  newEdges: NewEdge[],
  sizes: Map<string, Size>,
  preferFewerColumns: boolean,
): Map<string, { x: number; y: number }> | null {
  const ranks = computeRanks(newNodes, newEdges);
  const groups = new Map<number, string[]>();

  for (const node of newNodes) {
    const rank = ranks.get(node.id) ?? 0;
    groups.set(rank, [...(groups.get(rank) ?? []), node.id]);
  }

  const rankOrder = [...groups.keys()].sort((a, b) => a - b);

  if (rankOrder.length < 2) {
    return null;
  }

  const orderByRank = new Map<number, string[]>(
    rankOrder.map((rank) => [
      rank,
      [...(groups.get(rank) ?? [])].sort(),
    ]),
  );
  const neighbours = new Map<string, string[]>();

  for (const edge of newEdges) {
    if (!groups.has(0) || edge.from === edge.to) {
      continue;
    }

    neighbours.set(edge.from, [
      ...(neighbours.get(edge.from) ?? []),
      edge.to,
    ]);
    neighbours.set(edge.to, [
      ...(neighbours.get(edge.to) ?? []),
      edge.from,
    ]);
  }

  const barycenter = (
    id: string,
    reference: ReadonlyMap<string, number>,
    fallback: ReadonlyMap<string, number>,
  ) => {
    const positions = (neighbours.get(id) ?? [])
      .map((neighbour) => reference.get(neighbour))
      .filter((value): value is number => value !== undefined);

    if (positions.length === 0) {
      return fallback.get(id) ?? 0;
    }

    return positions.reduce((sum, value) => sum + value, 0) / positions.length;
  };

  for (let pass = 0; pass < 3; pass += 1) {
    for (let index = 1; index < rankOrder.length; index += 1) {
      const current = orderByRank.get(rankOrder[index] ?? 0) ?? [];
      const previous = orderByRank.get(rankOrder[index - 1] ?? 0) ?? [];
      const reference = new Map(previous.map((id, at) => [id, at]));
      const fallback = new Map(current.map((id, at) => [id, at]));

      current.sort(
        (a, b) =>
          barycenter(a, reference, fallback) -
            barycenter(b, reference, fallback) || a.localeCompare(b),
      );
    }

    for (let index = rankOrder.length - 2; index >= 0; index -= 1) {
      const current = orderByRank.get(rankOrder[index] ?? 0) ?? [];
      const next = orderByRank.get(rankOrder[index + 1] ?? 0) ?? [];
      const reference = new Map(next.map((id, at) => [id, at]));
      const fallback = new Map(current.map((id, at) => [id, at]));

      current.sort(
        (a, b) =>
          barycenter(a, reference, fallback) -
            barycenter(b, reference, fallback) || a.localeCompare(b),
      );
    }
  }

  const blocks: RankBlock[] = rankOrder.map((rank) => {
    const ids = orderByRank.get(rank) ?? [];
    const widths = ids.map((id) => sizes.get(id)?.width ?? MIN_WIDTH);
    const heights = ids.map((id) => sizes.get(id)?.height ?? MIN_HEIGHT);

    return {
      ids,
      width: Math.max(...widths),
      height:
        heights.reduce((sum, height) => sum + height, 0) +
        RANK_NODE_GAP * Math.max(0, ids.length - 1),
    };
  });

  type WrappedCandidate = {
    aspect: number;
    columns: number;
    crossings: number;
    positions: Map<string, { x: number; y: number }>;
  };
  const candidates: WrappedCandidate[] = [];

  for (let columns = 1; columns <= blocks.length; columns += 1) {
    const rows: RankBlock[][] = [];

    for (let index = 0; index < blocks.length; index += columns) {
      rows.push(blocks.slice(index, index + columns));
    }

    const rowWidths = rows.map(
      (row) =>
        row.reduce((sum, block) => sum + block.width, 0) +
        WRAP_ROW_GAP * Math.max(0, row.length - 1),
    );
    const rowHeights = rows.map((row) =>
      Math.max(...row.map((block) => block.height)),
    );
    const totalWidth = Math.max(...rowWidths);
    const totalHeight =
      rowHeights.reduce((sum, height) => sum + height, 0) +
      WRAP_ROW_GAP * Math.max(0, rows.length - 1);
    const aspect = totalWidth / Math.max(1, totalHeight);
    const positions = new Map<string, { x: number; y: number }>();
    let top = 0;

    rows.forEach((row, rowIndex) => {
      const rowHeight = rowHeights[rowIndex] ?? 0;
      const rowWidth = rowWidths[rowIndex] ?? 0;
      const orderedRow = rowIndex % 2 === 1 ? [...row].reverse() : row;
      let x = (totalWidth - rowWidth) / 2;

      for (const block of orderedRow) {
        let y = top + (rowHeight - block.height) / 2;

        for (const id of block.ids) {
          const size = sizes.get(id) ?? { width: MIN_WIDTH, height: MIN_HEIGHT };

          positions.set(id, {
            x: x + (block.width - size.width) / 2,
            y,
          });
          y += size.height + RANK_NODE_GAP;
        }

        x += block.width + WRAP_ROW_GAP;
      }

      top += rowHeight + WRAP_ROW_GAP;
    });

    candidates.push({
      aspect,
      columns,
      crossings: countLayoutCrossings(positions, sizes, newEdges),
      positions,
    });
  }

  const compact = candidates.filter(
    (candidate) => candidate.aspect >= 0.9 && candidate.aspect <= 2.6,
  );
  const pool = compact.length > 0 ? compact : candidates;

  if (preferFewerColumns) {
    pool.sort(
      (a, b) =>
        a.crossings - b.crossings ||
        a.columns - b.columns ||
        Math.abs(Math.log(a.aspect / TARGET_ASPECT)) -
          Math.abs(Math.log(b.aspect / TARGET_ASPECT)),
    );
  } else {
    pool.sort(
      (a, b) =>
        a.crossings - b.crossings ||
        Math.abs(Math.log(a.aspect / TARGET_ASPECT)) -
          Math.abs(Math.log(b.aspect / TARGET_ASPECT)),
    );
  }

  return pool[0]?.positions ?? null;
}

function countLayoutCrossings(
  positions: Map<string, { x: number; y: number }>,
  sizes: Map<string, Size>,
  edges: NewEdge[],
): number {
  const centers = new Map<string, { x: number; y: number }>();

  for (const [id, position] of positions) {
    const size = sizes.get(id) ?? { width: MIN_WIDTH, height: MIN_HEIGHT };

    centers.set(id, {
      x: position.x + size.width / 2,
      y: position.y + size.height / 2,
    });
  }

  const segments = edges
    .map((edge) => ({
      from: edge.from,
      to: edge.to,
      a: centers.get(edge.from),
      b: centers.get(edge.to),
    }))
    .filter(
      (segment): segment is {
        from: string;
        to: string;
        a: { x: number; y: number };
        b: { x: number; y: number };
      } => Boolean(segment.a && segment.b),
    );
  let crossings = 0;

  for (let i = 0; i < segments.length; i += 1) {
    for (let j = i + 1; j < segments.length; j += 1) {
      const one = segments[i];
      const two = segments[j];

      if (
        !one ||
        !two ||
        one.from === two.from ||
        one.from === two.to ||
        one.to === two.from ||
        one.to === two.to
      ) {
        continue;
      }

      if (segmentsCross(one.a, one.b, two.a, two.b)) {
        crossings += 1;
      }
    }
  }

  return crossings;
}

function segmentsCross(
  a: { x: number; y: number },
  b: { x: number; y: number },
  c: { x: number; y: number },
  d: { x: number; y: number },
): boolean {
  const orientation = (
    p: { x: number; y: number },
    q: { x: number; y: number },
    r: { x: number; y: number },
  ) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
  const straddles = (left: number, right: number) =>
    (left > 1e-6 && right < -1e-6) || (left < -1e-6 && right > 1e-6);

  return (
    straddles(orientation(a, b, c), orientation(a, b, d)) &&
    straddles(orientation(c, d, a), orientation(c, d, b))
  );
}

function computeRanks(
  newNodes: NewNode[],
  newEdges: NewEdge[],
): Map<string, number> {
  const ids = new Set(newNodes.map((node) => node.id));
  const adjacency = new Map<string, string[]>();
  const inDegree = new Map<string, number>(
    newNodes.map((node) => [node.id, 0]),
  );

  for (const edge of newEdges) {
    if (!ids.has(edge.from) || !ids.has(edge.to) || edge.from === edge.to) {
      continue;
    }

    adjacency.set(edge.from, [...(adjacency.get(edge.from) ?? []), edge.to]);
    inDegree.set(edge.to, (inDegree.get(edge.to) ?? 0) + 1);
  }

  const state = new Map<string, 0 | 1 | 2>();
  const dagEdges: Array<[string, string]> = [];

  const visit = (id: string) => {
    state.set(id, 1);

    for (const next of [...(adjacency.get(id) ?? [])].sort()) {
      if (state.get(next) === 1) {
        continue;
      }

      dagEdges.push([id, next]);

      if (!state.get(next)) {
        visit(next);
      }
    }

    state.set(id, 2);
  };

  const roots = [...ids]
    .filter((id) => (inDegree.get(id) ?? 0) === 0)
    .sort();

  for (const id of roots) {
    if (!state.get(id)) {
      visit(id);
    }
  }
  for (const id of [...ids].sort()) {
    if (!state.get(id)) {
      visit(id);
    }
  }

  const ranks = new Map<string, number>(newNodes.map((node) => [node.id, 0]));

  for (let pass = 0; pass < newNodes.length; pass += 1) {
    let changed = false;

    for (const [from, to] of dagEdges) {
      const candidate = (ranks.get(from) ?? 0) + 1;

      if (candidate > (ranks.get(to) ?? 0) && candidate < newNodes.length) {
        ranks.set(to, candidate);
        changed = true;
      }
    }

    if (!changed) {
      break;
    }
  }

  return ranks;
}

/**
 * Pure linear flows of 5+ nodes are wrapped into a centered snake so a simple
 * process does not render as one thin horizontal strip.
 */
function computeWrappedChainPositions(
  newNodes: NewNode[],
  newEdges: NewEdge[],
  sizes: Map<string, Size>,
): Map<string, { x: number; y: number }> | null {
  const chain = orderedChain(newNodes, newEdges);

  return chain ? wrapOrderedNodes(chain, sizes) : null;
}

/**
 * Architecture can arrive as a single chain (sometimes with a back edge).
 * Wrapping it keeps a five-step system from becoming one 1800px strip.
 */
function computeRankWrappedPositions(
  newNodes: NewNode[],
  newEdges: NewEdge[],
  sizes: Map<string, Size>,
): Map<string, { x: number; y: number }> | null {
  const order = orderedByRank(newNodes, newEdges);

  return order ? wrapOrderedNodes(order, sizes) : null;
}

function orderedByRank(
  newNodes: NewNode[],
  newEdges: NewEdge[],
): string[] | null {
  const ranks = computeRanks(newNodes, newEdges);
  const groups = new Map<number, string[]>();

  for (const node of newNodes) {
    const rank = ranks.get(node.id) ?? 0;
    groups.set(rank, [...(groups.get(rank) ?? []), node.id]);
  }

  const ranksInOrder = [...groups.keys()].sort((a, b) => a - b);

  if (ranksInOrder.length !== newNodes.length) {
    return null;
  }

  const order: string[] = [];

  for (const rank of ranksInOrder) {
    const group = groups.get(rank) ?? [];

    if (group.length !== 1 || !group[0]) {
      return null;
    }

    order.push(group[0]);
  }

  return order;
}

function wrapOrderedNodes(
  order: string[],
  sizes: Map<string, Size>,
): Map<string, { x: number; y: number }> | null {
  if (order.length < WRAP_MIN_CHAIN) {
    return null;
  }

  const rows: string[][] = [];

  for (let index = 0; index < order.length; index += 1) {
    const rowIndex = Math.floor(index / WRAP_RANKS_PER_ROW);

    rows[rowIndex] = [...(rows[rowIndex] ?? []), order[index] ?? ""];
  }

  const rowWidth = (row: string[]) => {
    const widths = row.map((id) => sizes.get(id)?.width ?? MIN_WIDTH);
    const total = widths.reduce((sum, width) => sum + width, 0);

    return total + WRAP_COLUMN_GAP * Math.max(0, row.length - 1);
  };
  const rowHeight = (row: string[]) =>
    Math.max(...row.map((id) => sizes.get(id)?.height ?? MIN_HEIGHT));
  const widest = Math.max(...rows.map(rowWidth));
  const positions = new Map<string, { x: number; y: number }>();
  let top = 0;

  for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex] ?? [];
    const height = rowHeight(row);
    const order = rowIndex % 2 === 1 ? [...row].reverse() : row;
    let x = (widest - rowWidth(row)) / 2;

    for (const id of order) {
      const size = sizes.get(id) ?? { width: MIN_WIDTH, height: MIN_HEIGHT };

      positions.set(id, {
        x,
        y: top + (height - size.height) / 2,
      });
      x += size.width + WRAP_COLUMN_GAP;
    }

    top += height + WRAP_ROW_GAP;
  }

  return positions;
}

function orderedChain(
  newNodes: NewNode[],
  newEdges: NewEdge[],
): string[] | null {
  const ids = new Set(newNodes.map((node) => node.id));
  const outgoing = new Map<string, string[]>();
  const incoming = new Map<string, number>();

  for (const node of newNodes) {
    incoming.set(node.id, 0);
  }

  for (const edge of newEdges) {
    if (!ids.has(edge.from) || !ids.has(edge.to)) {
      continue;
    }

    outgoing.set(edge.from, [...(outgoing.get(edge.from) ?? []), edge.to]);
    incoming.set(edge.to, (incoming.get(edge.to) ?? 0) + 1);
  }

  const starts = newNodes.filter((node) => (incoming.get(node.id) ?? 0) === 0);

  if (starts.length !== 1) {
    return null;
  }

  const chain: string[] = [];
  const seen = new Set<string>();
  let current: string | undefined = starts[0]?.id;

  while (current) {
    if (seen.has(current)) {
      return null;
    }

    seen.add(current);
    chain.push(current);

    const next = outgoing.get(current) ?? [];

    if (next.length > 1) {
      return null;
    }

    current = next[0];
  }

  return chain.length === newNodes.length ? chain : null;
}

function graphBounds(graph: dagre.graphlib.Graph): {
  width: number;
  height: number;
} {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const id of graph.nodes()) {
    const node = graph.node(id);

    minX = Math.min(minX, node.x - node.width / 2);
    minY = Math.min(minY, node.y - node.height / 2);
    maxX = Math.max(maxX, node.x + node.width / 2);
    maxY = Math.max(maxY, node.y + node.height / 2);
  }

  return { width: maxX - minX, height: maxY - minY };
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
