import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import type { Edge, Graph, Node } from "@wb/shared-types";

import { edgeLabelArrowId } from "./edgeLabels";
import {
  isSchemaDecoration,
  schemaRelationship,
  schemaTableData,
} from "./schemaTable";

type Box = Pick<Node, "x" | "y" | "width" | "height">;

function box(element: {
  x: number;
  y: number;
  width: number;
  height: number;
}): Box {
  return {
    x: Math.round(element.x),
    y: Math.round(element.y),
    width: Math.round(element.width),
    height: Math.round(element.height),
  };
}

export function excalidrawToGraph(
  elements: readonly ExcalidrawElement[],
): Graph {
  const live = elements.filter((element) => !element.isDeleted);
  const liveIds = new Set(live.map((element) => element.id));

  const labelsByContainerId = new Map<string, string>();
  const edgeLabelsByArrowId = new Map<string, string>();

  for (const element of live) {
    if (element.type !== "text") {
      continue;
    }

    const arrowId = edgeLabelArrowId(element);

    if (arrowId) {
      edgeLabelsByArrowId.set(arrowId, element.text);
    } else if (element.containerId) {
      labelsByContainerId.set(element.containerId, element.text);
    }
  }

  const nodes: Node[] = [];
  const edges: Edge[] = [];

  for (const element of live) {
    if (isSchemaDecoration(element)) {
      continue;
    }

    switch (element.type) {
      case "rectangle":
      case "ellipse":
      case "diamond": {
        const schema = schemaTableData(element);

        if (schema) {
          nodes.push({
            id: element.id,
            kind: "rectangle",
            text: schema.name,
            fields: schema.fields,
            ...box(element),
          });
          break;
        }

        const text = labelsByContainerId.get(element.id);
        nodes.push({
          id: element.id,
          kind: element.type,
          ...(text === undefined ? {} : { text }),
          ...box(element),
        });
        break;
      }

      case "text": {
        if (element.containerId || edgeLabelArrowId(element)) {
          break;
        }
        if (isSchemaDecoration(element)) {
          break;
        }
        nodes.push({
          id: element.id,
          kind: "text",
          text: element.text,
          ...box(element),
        });
        break;
      }

      case "freedraw": {
        nodes.push({ id: element.id, kind: "freedraw", ...box(element) });
        break;
      }

      case "arrow": {
        const from = element.startBinding?.elementId;
        const to = element.endBinding?.elementId;

        if (!from || !to || !liveIds.has(from) || !liveIds.has(to)) {
          break;
        }

        const label =
          labelsByContainerId.get(element.id) ??
          edgeLabelsByArrowId.get(element.id);
        const relationship = schemaRelationship(element);
        edges.push({
          id: element.id,
          from,
          to,
          ...(label === undefined ? {} : { label }),
          ...(relationship ?? {}),
        });
        break;
      }

      case "line": {
        const from = element.startBinding?.elementId;
        const to = element.endBinding?.elementId;
        const label =
          labelsByContainerId.get(element.id) ??
          edgeLabelsByArrowId.get(element.id);
        const relationship = schemaRelationship(element);

        if (from && to && liveIds.has(from) && liveIds.has(to)) {
          edges.push({
            id: element.id,
            from,
            to,
            ...(label === undefined ? {} : { label }),
            ...(relationship ?? {}),
          });
        } else {
          nodes.push({
            id: element.id,
            kind: "other",
            ...(label === undefined ? {} : { text: label }),
            ...box(element),
          });
        }
        break;
      }

      case "image":
      case "frame":
      case "magicframe":
      case "iframe":
      case "embeddable": {
        const text = labelsByContainerId.get(element.id);
        nodes.push({
          id: element.id,
          kind: "other",
          ...(text === undefined ? {} : { text }),
          ...box(element),
        });
        break;
      }

      case "selection": {
        break;
      }
    }
  }

  return { nodes, edges };
}
