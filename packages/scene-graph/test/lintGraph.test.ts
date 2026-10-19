import type { Graph, Node } from "@wb/shared-types";
import { describe, expect, it } from "vitest";

import { lintGraph } from "../src/lintGraph";

function node(id: string, text: string | undefined, kind: Node["kind"] = "rectangle"): Node {
  return { id, kind, ...(text === undefined ? {} : { text }), x: 0, y: 0, width: 120, height: 60 };
}

function graph(nodes: Node[], edges: Array<{ from: string; to: string }> = []): Graph {
  return {
    nodes,
    edges: edges.map((edge, index) => ({ id: `e${index + 1}`, ...edge })),
  };
}

describe("lintGraph", () => {
  it("returns nothing for a clean diagram", () => {
    expect(
      lintGraph(graph([node("a", "API"), node("b", "DB")], [{ from: "a", to: "b" }])),
    ).toEqual([]);
  });

  it("finds orphan shapes", () => {
    const issues = lintGraph(
      graph([node("a", "API"), node("b", "DB"), node("c", "Queue")], [{ from: "a", to: "b" }]),
    );

    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      kind: "orphan_node",
      nodeIds: ["c"],
    });
  });

  it("finds empty labels", () => {
    const issues = lintGraph(
      graph([node("a", "API"), node("b", undefined)], [{ from: "a", to: "b" }]),
    );

    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      kind: "empty_label",
      nodeIds: ["b"],
    });
  });

  it("finds duplicate labels after normalizing case and spaces", () => {
    const issues = lintGraph(
      graph([node("a", "API"), node("b", " api ")], [{ from: "a", to: "b" }]),
    );

    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      kind: "duplicate_label",
      nodeIds: ["a", "b"],
    });
  });

  it("finds self loops", () => {
    const issues = lintGraph(graph([node("a", "API")], [{ from: "a", to: "a" }]));

    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      kind: "self_loop",
      nodeIds: ["a"],
      edgeIds: ["e1"],
    });
  });

  it("finds disconnected clusters", () => {
    const issues = lintGraph(
      graph(
        [node("a", "API"), node("b", "DB"), node("c", "Web"), node("d", "Mobile")],
        [
          { from: "a", to: "b" },
          { from: "c", to: "d" },
        ],
      ),
    );

    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      kind: "disconnected",
      nodeIds: ["c", "d"],
    });
  });

  it("is deterministic", () => {
    const input = graph(
      [node("a", "API"), node("b", undefined), node("c", "API")],
      [{ from: "a", to: "b" }],
    );

    expect(lintGraph(input)).toEqual(lintGraph(input));
  });
});
