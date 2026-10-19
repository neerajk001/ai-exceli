import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import { placeNewNodes, tidy } from "@wb/layout";
import { applyOps } from "@wb/scene-graph";
import type { Graph, Op } from "@wb/shared-types";

export type TidyBoardResult = {
  ops: Op[];
  elements: ExcalidrawElement[];
  skipped: number;
};

export function tidyBoard(
  elements: readonly ExcalidrawElement[],
  graph: Graph,
): TidyBoardResult {
  const ops = tidy(graph);

  if (ops.length === 0) {
    return { ops, elements: [...elements], skipped: 0 };
  }

  const applied = applyOps(elements, ops, { layout: placeNewNodes });

  return {
    ops,
    elements: applied.elements,
    skipped: applied.skipped.length,
  };
}
