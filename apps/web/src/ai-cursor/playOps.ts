import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import type { OrderedExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import type { CaptureUpdateActionType } from "@excalidraw/excalidraw/store";
import type {
  Collaborator,
  ExcalidrawImperativeAPI,
  SocketId,
} from "@excalidraw/excalidraw/types";
import { placeNewNodes, type LayoutFunction } from "@wb/layout";
import { applyOps, excalidrawToGraph } from "@wb/scene-graph";
import type { NewNode, Op } from "@wb/shared-types";

const EVENTUALLY: CaptureUpdateActionType = "EVENTUALLY";
const IMMEDIATELY: CaptureUpdateActionType = "IMMEDIATELY";

const AI_SOCKET_ID = "ai-collaborator";
const AI_USERNAME = "AI";
const AI_COLOR = { background: "#4f46e5", stroke: "#c7d2fe" };
const MOVE_DURATION_MS = 400;
const PAUSE_MS = 250;
const FRAME_MS = 16;

type Point = { x: number; y: number };

export type PlayOpsOptions = {
  api: ExcalidrawImperativeAPI;
  ops: readonly Op[];
  signal?: AbortSignal;
  moveDurationMs?: number;
  pauseMs?: number;
  fitToViewport?: boolean;
  layout?: LayoutFunction;
};

export type PlayOpsResult = {
  applied: number;
  skipped: number;
  cancelled: boolean;
};

/**
 * Plays ops one at a time with an animated AI cursor. Each step is applied
 * with `CaptureUpdateAction.EVENTUALLY` and a single `IMMEDIATELY` commit at
 * the end, so the whole playback is one undo step.
 */
export async function playOps(options: PlayOpsOptions): Promise<PlayOpsResult> {
  const { api, ops, signal } = options;
  const moveDuration = options.moveDurationMs ?? MOVE_DURATION_MS;
  const pauseMs = options.pauseMs ?? PAUSE_MS;
  const originalViewMode = api.getAppState().viewModeEnabled;
  let elements: readonly ExcalidrawElement[] = api.getSceneElements();
  let cursor = startPoint(elements);
  let applied = 0;
  let skipped = 0;
  let cancelled = false;

  const plannedNodes = planNodes(
    elements,
    ops,
    options.layout ?? placeNewNodes,
  );
  const tempIds = new Map<string, string>();

  api.updateScene({ appState: { viewModeEnabled: true } });

  try {
    for (const rawOp of ops) {
      throwIfAborted(signal);

      const op = prepareOp(rawOp, tempIds, plannedNodes);
      const step = applyOps(elements, [op], {
        layout: options.layout ?? placeNewNodes,
        preserveGivenGeometry: true,
      });
      const target = targetPoint(op, step, elements);

      if (target) {
        await animateCursor(api, cursor, target, moveDuration, signal);
        cursor = target;
      }

      api.updateScene({
        elements: step.elements as unknown as OrderedExcalidrawElement[],
        captureUpdate: EVENTUALLY,
      });

      for (const [tempId, realId] of step.idMap) {
        tempIds.set(tempId, realId);
      }

      elements = step.elements;
      applied += 1;
      skipped += step.skipped.length;

      await delay(pauseMs, signal);
    }
  } catch (error) {
    if (!isAbortError(error)) {
      throw error;
    }

    cancelled = true;
  } finally {
    api.updateScene({
      elements: elements as unknown as OrderedExcalidrawElement[],
      captureUpdate: IMMEDIATELY,
    });
    removeCursor(api);
    api.updateScene({ appState: { viewModeEnabled: originalViewMode } });
  }

  if (options.fitToViewport && !cancelled) {
    api.scrollToContent(api.getSceneElements(), {
      fitToContent: true,
      animate: true,
      duration: 400,
    });
  }

  return { applied, skipped, cancelled };
}

function planNodes(
  elements: readonly ExcalidrawElement[],
  ops: readonly Op[],
  layout: LayoutFunction,
): Map<string, NewNode> {
  const newNodes = ops
    .filter((op) => op.type === "add_node")
    .map((op) => op.node);
  const newEdges = ops
    .filter((op) => op.type === "add_edge")
    .map((op) => op.edge);

  if (newNodes.length === 0) {
    return new Map();
  }

  const placed = layout(excalidrawToGraph(elements), newNodes, newEdges);

  return new Map(placed.map((node) => [node.id, node]));
}

function prepareOp(
  op: Op,
  tempIds: Map<string, string>,
  plannedNodes: Map<string, NewNode>,
): Op {
  if (op.type === "add_node") {
    const planned = plannedNodes.get(op.node.id);

    if (!planned || op.node.x !== undefined || op.node.y !== undefined) {
      return op;
    }

    return {
      type: "add_node",
      node: {
        ...op.node,
        x: planned.x,
        y: planned.y,
        width: planned.width,
        height: planned.height,
      },
    };
  }

  if (op.type === "add_edge") {
    return {
      type: "add_edge",
      edge: {
        ...op.edge,
        from: tempIds.get(op.edge.from) ?? op.edge.from,
        to: tempIds.get(op.edge.to) ?? op.edge.to,
      },
    };
  }

  return { ...op, id: tempIds.get(op.id) ?? op.id };
}

function startPoint(elements: readonly ExcalidrawElement[]): Point {
  if (elements.length === 0) {
    return { x: 0, y: 0 };
  }

  return {
    x: Math.min(...elements.map((element) => element.x)),
    y: Math.min(...elements.map((element) => element.y)),
  };
}

function targetPoint(
  op: Op,
  step: { elements: ExcalidrawElement[]; idMap: Map<string, string> },
  previousElements: readonly ExcalidrawElement[],
): Point | null {
  let element: ExcalidrawElement | undefined;

  if (op.type === "add_node") {
    element = findById(step.elements, step.idMap.get(op.node.id));
  } else if (op.type === "add_edge") {
    element = findById(step.elements, step.idMap.get(op.edge.id));
  } else if (op.type === "update_node") {
    element = findById(step.elements, op.id);
  } else {
    element = findById(previousElements, op.id);
  }

  if (!element) {
    return null;
  }

  return {
    x: element.x + element.width / 2,
    y: element.y + element.height / 2,
  };
}

function findById(
  elements: readonly ExcalidrawElement[],
  id: string | undefined,
): ExcalidrawElement | undefined {
  if (id === undefined) {
    return undefined;
  }

  return elements.find((element) => element.id === id);
}

function setCursor(api: ExcalidrawImperativeAPI, point: Point): void {
  const collaborator: Collaborator = {
    username: AI_USERNAME,
    color: AI_COLOR,
    pointer: { x: point.x, y: point.y, tool: "pointer" },
  };
  const collaborators = new Map(api.getAppState().collaborators);

  collaborators.set(AI_SOCKET_ID as SocketId, collaborator);
  api.updateScene({ collaborators });
}

function removeCursor(api: ExcalidrawImperativeAPI): void {
  const collaborators = new Map(api.getAppState().collaborators);

  collaborators.delete(AI_SOCKET_ID as SocketId);
  api.updateScene({ collaborators });
}

async function animateCursor(
  api: ExcalidrawImperativeAPI,
  from: Point,
  to: Point,
  duration: number,
  signal: AbortSignal | undefined,
): Promise<void> {
  if (duration <= 0 || (from.x === to.x && from.y === to.y)) {
    setCursor(api, to);
    return;
  }

  const startedAt = Date.now();

  await new Promise<void>((resolve, reject) => {
    let handle = 0;

    const onAbort = () => {
      cancelFrame(handle);
      signal?.removeEventListener("abort", onAbort);
      reject(abortPlayback());
    };

    const tick = () => {
      const progress = Math.min(1, (Date.now() - startedAt) / duration);

      setCursor(api, {
        x: from.x + (to.x - from.x) * progress,
        y: from.y + (to.y - from.y) * progress,
      });

      if (progress < 1) {
        handle = requestFrame(tick);
      } else {
        signal?.removeEventListener("abort", onAbort);
        resolve();
      }
    };

    if (signal?.aborted) {
      reject(abortPlayback());
      return;
    }

    signal?.addEventListener("abort", onAbort);
    handle = requestFrame(tick);
  });
}

function delay(ms: number, signal: AbortSignal | undefined): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(abortPlayback());
      return;
    }

    const onAbort = () => {
      clearTimeout(handle);
      signal?.removeEventListener("abort", onAbort);
      reject(abortPlayback());
    };

    const handle = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);

    signal?.addEventListener("abort", onAbort);
  });
}

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) {
    throw abortPlayback();
  }
}

function abortPlayback(): Error {
  const error = new Error("Playback cancelled");
  error.name = "AbortError";
  return error;
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

function requestFrame(callback: () => void): number {
  if (typeof globalThis.requestAnimationFrame === "function") {
    return globalThis.requestAnimationFrame(() => callback());
  }

  return setTimeout(callback, FRAME_MS) as unknown as number;
}

function cancelFrame(handle: number): void {
  if (typeof globalThis.cancelAnimationFrame === "function") {
    globalThis.cancelAnimationFrame(handle);
  } else {
    clearTimeout(handle);
  }
}
