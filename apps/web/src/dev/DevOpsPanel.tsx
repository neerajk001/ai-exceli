import { CaptureUpdateAction } from "@excalidraw/excalidraw";
import type { OrderedExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import { placeNewNodes } from "@wb/layout";
import { applyOps, excalidrawToGraph } from "@wb/scene-graph";
import type { Graph, Op } from "@wb/shared-types";
import { useState } from "react";

import { useCanvasApi } from "../canvas/CanvasApiContext";

type OpsBuilder = (graph: Graph) => Op[] | string;

const addCacheNode: OpsBuilder = (graph) => {
  const api = graph.nodes.find((node) => node.text?.startsWith("API"));
  const db = graph.nodes.find((node) => node.text?.startsWith("Database"));

  if (!api || !db) {
    return "Draw nodes labeled 'API' and 'Database' first.";
  }

  return [
    {
      type: "add_node",
      node: { id: "new_cache", kind: "rectangle", text: "Cache\nredis" },
    },
    {
      type: "add_edge",
      edge: { id: "new_edge_1", from: api.id, to: "new_cache", label: "cache" },
    },
    {
      type: "add_edge",
      edge: { id: "new_edge_2", from: "new_cache", to: db.id, label: "reads" },
    },
  ];
};

const renameApiNode: OpsBuilder = (graph) => {
  const api = graph.nodes.find((node) => node.text?.startsWith("API"));

  if (!api) {
    return "Draw a node labeled 'API' first.";
  }

  return [
    {
      type: "update_node",
      id: api.id,
      patch: { text: "API Gateway\nhandles auth" },
    },
  ];
};

const deleteDatabaseNode: OpsBuilder = (graph) => {
  const db = graph.nodes.find((node) => node.text?.startsWith("Database"));

  if (!db) {
    return "Draw a node labeled 'Database' first.";
  }

  return [{ type: "delete", id: db.id }];
};

export function DevOpsPanel() {
  const api = useCanvasApi();
  const [log, setLog] = useState<string | null>(null);

  const run = (builder: OpsBuilder) => {
    if (!api) {
      setLog("Canvas is still loading...");
      return;
    }

    const elements = api.getSceneElements();
    const built = builder(excalidrawToGraph(elements));

    if (typeof built === "string") {
      setLog(built);
      return;
    }

    const result = applyOps(elements, built, { layout: placeNewNodes });

    api.updateScene({
      elements: result.elements as unknown as OrderedExcalidrawElement[],
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    });

    setLog(
      `applied ${built.length - result.skipped.length}/${built.length} ops` +
        (result.skipped.length > 0 ? `, skipped ${result.skipped.length}` : ""),
    );
  };

  return (
    <div className="dev-ops">
      <span className="dev-ops-title">dev ops</span>
      <button type="button" onClick={() => run(addCacheNode)}>
        Add cache node
      </button>
      <button type="button" onClick={() => run(renameApiNode)}>
        Rename API
      </button>
      <button type="button" onClick={() => run(deleteDatabaseNode)}>
        Delete Database
      </button>
      {log ? <span className="dev-ops-log">{log}</span> : null}
    </div>
  );
}
