import type {
  ExcalidrawElement,
  ExcalidrawTextElement,
  FractionalIndex,
} from "@excalidraw/excalidraw/element/types";
import type { LayoutFunction } from "@wb/layout";
import type { NewEdge, NewNode, Op } from "@wb/shared-types";
import { generateKeyBetween } from "fractional-indexing";

import { excalidrawToGraph } from "./excalidrawToGraph";

export type ApplyOpsOptions = {
  layout: LayoutFunction;
  preserveGivenGeometry?: boolean;
};

export type SkippedOp = {
  op: Op;
  reason: string;
};

export type ApplyOpsResult = {
  elements: ExcalidrawElement[];
  idMap: Map<string, string>;
  skipped: SkippedOp[];
};

type Box = { x: number; y: number; width: number; height: number };
type BoundElement = { type: "text" | "arrow"; id: string };
type ShapeKind = "rectangle" | "ellipse" | "diamond";
type Store = Map<string, ExcalidrawElement>;

const SHAPE_KINDS: readonly string[] = ["rectangle", "ellipse", "diamond"];

const FONT_SIZE = 20;
const FONT_FAMILY = 5;
const LINE_HEIGHT = 1.25;
const TEXT_WIDTH_FACTOR = 0.5;

const DEFAULT_STROKE = "#1e1e1e";

export function applyOps(
  elements: readonly ExcalidrawElement[],
  ops: readonly Op[],
  options: ApplyOpsOptions,
): ApplyOpsResult {
  const store: Store = new Map();
  for (const element of elements) {
    store.set(element.id, cloneElement(element));
  }

  const skipped: SkippedOp[] = [];
  const idMap = new Map<string, string>();
  const addedIds: string[] = [];

  const newNodes: NewNode[] = [];
  const newEdges: NewEdge[] = [];
  for (const op of ops) {
    if (op.type === "add_node") {
      newNodes.push(op.node);
    } else if (op.type === "add_edge") {
      newEdges.push(op.edge);
    }
  }

  let lastIndex = highestIndex(elements);
  const nextIndex = (): FractionalIndex => {
    const key = generateKeyBetween(lastIndex, null);
    lastIndex = key;
    return key as FractionalIndex;
  };

  const insert = (element: ExcalidrawElement) => {
    store.set(element.id, element);
    addedIds.push(element.id);
  };

  const bind = (elementId: string, bound: BoundElement) => {
    const element = store.get(elementId);
    if (!element) {
      return;
    }
    const current = element.boundElements ?? [];
    if (current.some((candidate) => candidate.id === bound.id)) {
      return;
    }
    store.set(
      elementId,
      withPatch(element, { boundElements: [...current, bound] }),
    );
  };

  const boxOf = (id: string): Box | undefined => {
    const element = store.get(id);
    if (!element) {
      return undefined;
    }
    return {
      x: element.x,
      y: element.y,
      width: element.width,
      height: element.height,
    };
  };

  if (newNodes.length > 0 || newEdges.length > 0) {
    const givenNodes = options.preserveGivenGeometry
      ? newNodes.filter(hasFullGeometry)
      : [];
    const nodesToPlace = options.preserveGivenGeometry
      ? newNodes.filter((node) => !hasFullGeometry(node))
      : newNodes;
    const placedNodes = options.layout(
      excalidrawToGraph(elements),
      nodesToPlace,
      newEdges,
    );

    for (const node of [...placedNodes, ...givenNodes]) {
      const id = createId();
      idMap.set(node.id, id);

      const box: Box = {
        x: node.x ?? 0,
        y: node.y ?? 0,
        width: node.width ?? 120,
        height: node.height ?? 60,
      };

      if (node.kind === "text") {
        insert(
          createTextElement({
            containerId: null,
            box,
            text: node.text ?? "",
            index: nextIndex(),
          }),
        );
        continue;
      }

      const shape = createShapeElement(
        id,
        isShapeKind(node.kind) ? node.kind : "rectangle",
        box,
        nextIndex(),
      );
      insert(shape);

      if (node.text) {
        const textElement = createTextElement({
          containerId: shape.id,
          box: centeredTextBox(box, node.text),
          text: node.text,
          index: nextIndex(),
        });
        insert(textElement);
        bind(shape.id, { type: "text", id: textElement.id });
      }
    }

    for (const edge of newEdges) {
      const fromId = resolveId(edge.from, idMap, store);
      const toId = resolveId(edge.to, idMap, store);

      if (!fromId || !toId) {
        skipped.push({
          op: { type: "add_edge", edge },
          reason: `unknown ${fromId ? "to" : "from"} id "${fromId ? edge.to : edge.from}"`,
        });
        continue;
      }

      const fromBox = boxOf(fromId);
      const toBox = boxOf(toId);

      if (!fromBox || !toBox) {
        skipped.push({
          op: { type: "add_edge", edge },
          reason: `cannot resolve the geometry of "${edge.from}" or "${edge.to}"`,
        });
        continue;
      }

      const arrow = createArrowElement({
        id: createId(),
        from: centerOf(fromBox),
        to: centerOf(toBox),
        fromId,
        toId,
        index: nextIndex(),
      });
      idMap.set(edge.id, arrow.id);
      insert(arrow);

      bind(fromId, { type: "arrow", id: arrow.id });
      bind(toId, { type: "arrow", id: arrow.id });

      if (edge.label) {
        const target = boxOf(arrow.id) ?? {
          x: 0,
          y: 0,
          width: 0,
          height: 0,
        };
        const label = createTextElement({
          containerId: arrow.id,
          box: centeredTextBox(target, edge.label),
          text: edge.label,
          index: nextIndex(),
        });
        insert(label);
        bind(arrow.id, { type: "text", id: label.id });
      }
    }
  }

  for (const op of ops) {
    if (op.type === "update_node") {
      applyUpdate(op, store, idMap, skipped, bind, nextIndex);
    } else if (op.type === "delete") {
      applyDelete(op, store, idMap, skipped);
    }
  }

  const result: ExcalidrawElement[] = [];
  for (const element of elements) {
    const current = store.get(element.id);
    if (current) {
      result.push(current);
    }
  }
  for (const id of addedIds) {
    const current = store.get(id);
    if (current) {
      result.push(current);
    }
  }

  return { elements: result, idMap, skipped };
}

function applyUpdate(
  op: Extract<Op, { type: "update_node" }>,
  store: Store,
  idMap: Map<string, string>,
  skipped: SkippedOp[],
  bind: (elementId: string, bound: BoundElement) => void,
  nextIndex: () => FractionalIndex,
): void {
  const elementId = resolveId(op.id, idMap, store);
  const element = elementId ? store.get(elementId) : undefined;

  if (!elementId || !element) {
    skipped.push({ op, reason: `unknown id "${op.id}"` });
    return;
  }

  if (op.patch.kind !== undefined && op.patch.kind !== element.type) {
    if (isShapeKind(op.patch.kind) && isShapeKind(element.type)) {
      store.set(elementId, withPatch(element, { type: op.patch.kind }));
    } else {
      skipped.push({
        op,
        reason: `cannot change the kind of "${element.type}" to "${op.patch.kind}"`,
      });
    }
  }

  const geometryChanged = (["x", "y", "width", "height"] as const).some(
    (key) => op.patch[key] !== undefined,
  );

  if (geometryChanged) {
    const current = store.get(elementId) ?? element;
    store.set(
      elementId,
      withPatch(current, {
        ...(op.patch.x !== undefined ? { x: op.patch.x } : {}),
        ...(op.patch.y !== undefined ? { y: op.patch.y } : {}),
        ...(op.patch.width !== undefined ? { width: op.patch.width } : {}),
        ...(op.patch.height !== undefined ? { height: op.patch.height } : {}),
      }),
    );
  }

  if (op.patch.text === undefined) {
    if (geometryChanged) {
      recenterBoundText(store, elementId);
    }
    return;
  }

  const boundText = findBoundText(store, elementId);

  if (boundText) {
    const size = measureText(op.patch.text);
    store.set(
      boundText.id,
      withPatch(boundText, {
        text: op.patch.text,
        originalText: op.patch.text,
        width: size.width,
        height: size.height,
      }),
    );
    recenterBoundText(store, elementId);
    return;
  }

  const current = store.get(elementId) ?? element;

  if (current.type === "text") {
    const size = measureText(op.patch.text);
    store.set(
      elementId,
      withPatch(current, {
        text: op.patch.text,
        originalText: op.patch.text,
        width: size.width,
        height: size.height,
      }),
    );
    return;
  }

  const textElement = createTextElement({
    containerId: elementId,
    box: centeredTextBox(boxOfElement(current), op.patch.text),
    text: op.patch.text,
    index: nextIndex(),
  });
  store.set(textElement.id, textElement);
  bind(elementId, { type: "text", id: textElement.id });
}

function applyDelete(
  op: Extract<Op, { type: "delete" }>,
  store: Store,
  idMap: Map<string, string>,
  skipped: SkippedOp[],
): void {
  const elementId = resolveId(op.id, idMap, store);

  if (!elementId || !store.has(elementId)) {
    skipped.push({ op, reason: `unknown id "${op.id}"` });
    return;
  }

  const removeIds = new Set<string>([elementId]);

  for (let pass = 0; pass < 2; pass += 1) {
    for (const candidate of store.values()) {
      if (
        candidate.type === "text" &&
        candidate.containerId &&
        removeIds.has(candidate.containerId)
      ) {
        removeIds.add(candidate.id);
      }
      if (
        candidate.type === "arrow" &&
        ((candidate.startBinding?.elementId &&
          removeIds.has(candidate.startBinding.elementId)) ||
          (candidate.endBinding?.elementId &&
            removeIds.has(candidate.endBinding.elementId)))
      ) {
        removeIds.add(candidate.id);
      }
    }
  }

  for (const id of removeIds) {
    store.delete(id);
  }

  for (const element of [...store.values()]) {
    if (
      element.boundElements?.some((bound) => removeIds.has(bound.id)) === true
    ) {
      store.set(
        element.id,
        withPatch(element, {
          boundElements: (element.boundElements ?? []).filter(
            (bound) => !removeIds.has(bound.id),
          ),
        }),
      );
    }
  }
}

function recenterBoundText(store: Store, containerId: string): void {
  const container = store.get(containerId);
  const text = findBoundText(store, containerId);

  if (!container || !text) {
    return;
  }

  store.set(
    text.id,
    withPatch(text, {
      x: container.x + (container.width - text.width) / 2,
      y: container.y + (container.height - text.height) / 2,
    }),
  );
}

function withPatch(
  element: ExcalidrawElement,
  patch: Record<string, unknown>,
): ExcalidrawElement {
  return { ...element, ...patch } as unknown as ExcalidrawElement;
}

function cloneElement(element: ExcalidrawElement): ExcalidrawElement {
  return {
    ...element,
    groupIds: [...element.groupIds],
    boundElements: element.boundElements
      ? [...element.boundElements]
      : element.boundElements,
  } as ExcalidrawElement;
}

function hasFullGeometry(node: NewNode): boolean {
  return (
    node.x !== undefined &&
    node.y !== undefined &&
    node.width !== undefined &&
    node.height !== undefined
  );
}

function resolveId(
  id: string,
  idMap: Map<string, string>,
  store: Store,
): string | undefined {
  const mapped = idMap.get(id) ?? id;
  return store.has(mapped) ? mapped : undefined;
}

function findBoundText(
  store: Store,
  containerId: string,
): ExcalidrawTextElement | undefined {
  for (const element of store.values()) {
    if (element.type === "text" && element.containerId === containerId) {
      return element;
    }
  }
  return undefined;
}

function createShapeElement(
  id: string,
  type: ShapeKind,
  box: Box,
  index: FractionalIndex,
): ExcalidrawElement {
  return {
    ...baseElement(id, box, index),
    type,
  } as unknown as ExcalidrawElement;
}

function createTextElement(input: {
  containerId: string | null;
  box: Box;
  text: string;
  index: FractionalIndex;
}): ExcalidrawTextElement {
  return {
    ...baseElement(createId(), input.box, input.index),
    type: "text",
    text: input.text,
    fontSize: FONT_SIZE,
    fontFamily: FONT_FAMILY,
    textAlign: "center",
    verticalAlign: "middle",
    containerId: input.containerId,
    originalText: input.text,
    autoResize: true,
    lineHeight: LINE_HEIGHT,
  } as unknown as ExcalidrawTextElement;
}

function createArrowElement(input: {
  id: string;
  from: { x: number; y: number };
  to: { x: number; y: number };
  fromId: string;
  toId: string;
  index: FractionalIndex;
}): ExcalidrawElement {
  const minX = Math.min(input.from.x, input.to.x);
  const minY = Math.min(input.from.y, input.to.y);

  return {
    ...baseElement(
      input.id,
      {
        x: minX,
        y: minY,
        width: Math.abs(input.to.x - input.from.x),
        height: Math.abs(input.to.y - input.from.y),
      },
      input.index,
    ),
    type: "arrow",
    points: [
      [input.from.x - minX, input.from.y - minY],
      [input.to.x - minX, input.to.y - minY],
    ],
    lastCommittedPoint: null,
    startBinding: { elementId: input.fromId, focus: 0, gap: 4 },
    endBinding: { elementId: input.toId, focus: 0, gap: 4 },
    startArrowhead: null,
    endArrowhead: "arrow",
    elbowed: false,
  } as unknown as ExcalidrawElement;
}

function baseElement(id: string, box: Box, index: FractionalIndex | null) {
  return {
    id,
    x: box.x,
    y: box.y,
    width: box.width,
    height: box.height,
    angle: 0,
    strokeColor: DEFAULT_STROKE,
    backgroundColor: "transparent",
    fillStyle: "solid",
    strokeWidth: 2,
    strokeStyle: "solid",
    roughness: 1,
    opacity: 100,
    groupIds: [] as string[],
    frameId: null,
    index,
    roundness: null,
    seed: randomSeed(),
    version: 1,
    versionNonce: randomSeed(),
    isDeleted: false,
    boundElements: [] as BoundElement[],
    updated: Date.now(),
    link: null,
    locked: false,
  };
}

function measureText(text: string): { width: number; height: number } {
  const lines = text.length === 0 ? [""] : text.split("\n");
  const longest = Math.max(...lines.map((line) => line.length));

  return {
    width: Math.max(FONT_SIZE, longest * FONT_SIZE * TEXT_WIDTH_FACTOR),
    height: Math.max(
      FONT_SIZE * LINE_HEIGHT,
      lines.length * FONT_SIZE * LINE_HEIGHT,
    ),
  };
}

function centeredTextBox(container: Box, text: string): Box {
  const size = measureText(text);

  return {
    x: container.x + (container.width - size.width) / 2,
    y: container.y + (container.height - size.height) / 2,
    width: size.width,
    height: size.height,
  };
}

function boxOfElement(element: ExcalidrawElement): Box {
  return {
    x: element.x,
    y: element.y,
    width: element.width,
    height: element.height,
  };
}

function centerOf(box: Box): { x: number; y: number } {
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

function isShapeKind(kind: string): kind is ShapeKind {
  return SHAPE_KINDS.includes(kind);
}

function highestIndex(elements: readonly ExcalidrawElement[]): string | null {
  const indices = elements
    .map((element) => element.index as string | null)
    .filter((index): index is string => typeof index === "string")
    .sort();

  return indices.length > 0 ? (indices[indices.length - 1] as string) : null;
}

function createId(): string {
  return `wb_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
}

function randomSeed(): number {
  return Math.floor(Math.random() * 2 ** 31);
}
