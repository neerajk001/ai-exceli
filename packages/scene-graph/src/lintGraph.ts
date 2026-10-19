import type { Edge, Graph, Node } from "@wb/shared-types";

export type LintIssueKind =
  | "orphan_node"
  | "empty_label"
  | "duplicate_label"
  | "self_loop"
  | "disconnected";

export type LintIssue = {
  id: string;
  kind: LintIssueKind;
  message: string;
  nodeIds: string[];
  edgeIds: string[];
};

const SHAPE_KINDS: ReadonlySet<Node["kind"]> = new Set([
  "rectangle",
  "ellipse",
  "diamond",
]);

export function lintGraph(graph: Graph): LintIssue[] {
  const shapes = graph.nodes.filter((node) => SHAPE_KINDS.has(node.kind));
  const shapeIds = new Set(shapes.map((node) => node.id));
  const edges = graph.edges.filter(
    (edge) => shapeIds.has(edge.from) && shapeIds.has(edge.to),
  );
  const connected = new Set<string>();

  for (const edge of edges) {
    connected.add(edge.from);
    connected.add(edge.to);
  }

  const issues: LintIssue[] = [];

  for (const node of sortById(shapes)) {
    if (!connected.has(node.id)) {
      issues.push({
        id: `orphan:${node.id}`,
        kind: "orphan_node",
        message: `"${labelOf(node)}" is not connected to anything`,
        nodeIds: [node.id],
        edgeIds: [],
      });
    }
  }

  for (const node of sortById(shapes)) {
    if (!node.text?.trim()) {
      issues.push({
        id: `empty:${node.id}`,
        kind: "empty_label",
        message: `"${labelOf(node)}" has no label`,
        nodeIds: [node.id],
        edgeIds: [],
      });
    }
  }

  const byLabel = new Map<string, string[]>();

  for (const node of sortById(shapes)) {
    const label = normalizeLabel(node.text);

    if (label.length === 0) {
      continue;
    }

    byLabel.set(label, [...(byLabel.get(label) ?? []), node.id]);
  }

  for (const [label, ids] of [...byLabel.entries()].sort(([a], [b]) =>
    a.localeCompare(b),
  )) {
    if (ids.length > 1) {
      issues.push({
        id: `duplicate:${label}`,
        kind: "duplicate_label",
        message: `"${label}" is used by ${ids.length} shapes`,
        nodeIds: ids,
        edgeIds: [],
      });
    }
  }

  for (const edge of edges) {
    if (edge.from === edge.to) {
      issues.push({
        id: `self-loop:${edge.id}`,
        kind: "self_loop",
        message: `"${labelOf(findNode(shapes, edge.from))}" points to itself`,
        nodeIds: [edge.from],
        edgeIds: [edge.id],
      });
    }
  }

  const groups = connectedComponents(edges).sort(
    (a, b) => b.length - a.length || (a[0] ?? "").localeCompare(b[0] ?? ""),
  );

  for (const group of groups.slice(1)) {
    const nodeIds = [...group].sort();

    issues.push({
      id: `disconnected:${nodeIds[0] ?? "group"}`,
      kind: "disconnected",
      message: "This part of the diagram is disconnected from the rest",
      nodeIds,
      edgeIds: [],
    });
  }

  return issues;
}

function connectedComponents(edges: Edge[]): string[][] {
  const adjacency = new Map<string, Set<string>>();

  for (const edge of edges) {
    if (edge.from === edge.to) {
      continue;
    }

    addNeighbour(adjacency, edge.from, edge.to);
    addNeighbour(adjacency, edge.to, edge.from);
  }

  const visited = new Set<string>();
  const groups: string[][] = [];

  for (const start of [...adjacency.keys()].sort()) {
    if (visited.has(start)) {
      continue;
    }

    const group: string[] = [];
    const queue = [start];
    visited.add(start);

    while (queue.length > 0) {
      const current = queue.shift() ?? "";
      group.push(current);

      for (const next of adjacency.get(current) ?? []) {
        if (!visited.has(next)) {
          visited.add(next);
          queue.push(next);
        }
      }
    }

    groups.push(group.sort());
  }

  return groups;
}

function addNeighbour(
  adjacency: Map<string, Set<string>>,
  from: string,
  to: string,
): void {
  const neighbours = adjacency.get(from) ?? new Set<string>();

  neighbours.add(to);
  adjacency.set(from, neighbours);
}

function sortById(nodes: Node[]): Node[] {
  return [...nodes].sort((a, b) => a.id.localeCompare(b.id));
}

function normalizeLabel(text: string | undefined): string {
  return (text ?? "").trim().replace(/\s+/g, " ").toLowerCase();
}

function labelOf(node: Node | undefined): string {
  const firstLine = node?.text?.split("\n")[0]?.trim();

  return firstLine && firstLine.length > 0 ? firstLine : (node?.id ?? "element");
}

function findNode(nodes: Node[], id: string): Node | undefined {
  return nodes.find((node) => node.id === id);
}
