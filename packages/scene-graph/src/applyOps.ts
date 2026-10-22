import type {
  ExcalidrawElement,
  ExcalidrawTextElement,
  FractionalIndex,
} from "@excalidraw/excalidraw/element/types";
import {
  EDGE_FONT_SIZE,
  NODE_FONT_SIZE,
  NODE_LINE_HEIGHT_RATIO,
  SCHEMA_FIELD_FONT_SIZE,
  SCHEMA_HEADER_FONT_SIZE,
  SCHEMA_PADDING_X,
  TEXT_WIDTH_RATIO,
  estimateSchemaTable,
  formatCardinality,
  schemaRowCenterY,
  wrapEdgeText,
  wrapNodeText,
  type LayoutFunction,
  type SchemaTableMetrics,
} from "@wb/layout";
import type { NewEdge, NewNode, Op, SchemaField } from "@wb/shared-types";
import { generateKeyBetween } from "fractional-indexing";

import { edgeLabelArrowId, edgeLabelCustomData } from "./edgeLabels";
import { excalidrawToGraph } from "./excalidrawToGraph";
import {
  isSchemaDecoration,
  schemaDecorationCustomData,
  schemaDecorationFor,
  schemaRelationshipCustomData,
  schemaTableCustomData,
  schemaTableData,
} from "./schemaTable";
import { validateDiagramLayout, type LayoutIssue } from "./validateLayout";

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
  layoutIssues: LayoutIssue[];
};

type Box = { x: number; y: number; width: number; height: number };
type Point = { x: number; y: number };
type Segment = { a: Point; b: Point };
type PortSide = "left" | "right" | "top" | "bottom";
type BoundElement = { type: "text" | "arrow"; id: string };
type ShapeKind = "rectangle" | "ellipse" | "diamond";
type Store = Map<string, ExcalidrawElement>;

const SHAPE_KINDS: readonly string[] = ["rectangle", "ellipse", "diamond"];

const LABEL_OFFSETS = (() => {
  const offsets: Array<{ dx: number; dy: number; distance: number }> = [];
  const radius = 480;
  const step = 20;

  for (let dx = -radius; dx <= radius; dx += step) {
    for (let dy = -radius; dy <= radius; dy += step) {
      offsets.push({ dx, dy, distance: Math.abs(dx) + Math.abs(dy) });
    }
  }

  return offsets.sort((a, b) => a.distance - b.distance);
})();

const FONT_FAMILY = 2;
const LINE_HEIGHT = NODE_LINE_HEIGHT_RATIO;
const LABEL_GAP = 10;

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
  const routedSegments: Segment[] = [];
  const usedPorts = new Map<string, Map<PortSide, number[]>>();

  for (const element of store.values()) {
    if (element.type === "arrow") {
      routedSegments.push(...arrowSegments(element));
    }
  }

  type PendingLabel = {
    arrowId: string;
    text: string;
    points: Point[];
    fromBox: Box;
    toBox: Box;
  };
  const pendingLabels: PendingLabel[] = [];

  const newNodes: NewNode[] = [];
  const newEdges: NewEdge[] = [];
  for (const op of ops) {
    if (op.type === "add_node") {
      newNodes.push(op.node);
    } else if (op.type === "add_edge") {
      newEdges.push(op.edge);
    }
  }

  const backEdges = findBackEdgeIds(newEdges);
  const ranks = rankNodes(newEdges, backEdges);
  const longEdges = new Set(
    newEdges
      .filter(
        (edge) =>
          !backEdges.has(edge.id) &&
          (ranks.get(edge.to) ?? 0) - (ranks.get(edge.from) ?? 0) > 1,
      )
      .map((edge) => edge.id),
  );
  const outsideEdges = new Set([...backEdges, ...longEdges]);
  const edgeOrder = [
    ...newEdges.filter((edge) => !outsideEdges.has(edge.id)),
    ...newEdges.filter((edge) => longEdges.has(edge.id)),
    ...newEdges.filter((edge) => backEdges.has(edge.id)),
  ];

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

      const isSchema = Boolean(node.fields?.length);
      const metrics = isSchema
        ? estimateSchemaTable(node.text ?? "table", node.fields ?? [])
        : null;
      const box: Box = {
        x: node.x ?? 0,
        y: node.y ?? 0,
        width: Math.max(node.width ?? 0, metrics?.width ?? 120),
        height: Math.max(node.height ?? 0, metrics?.height ?? 60),
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

      if (isSchema && metrics) {
        insertSchemaTable({
          id,
          box,
          metrics,
          name: node.text ?? "table",
          fields: node.fields ?? [],
          insert,
          nextIndex,
        });
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
        const wrapped = wrapNodeText(node.text, box.width);
        const textElement = createTextElement({
          containerId: shape.id,
          box: centeredTextBox(box, wrapped.text),
          text: wrapped.text,
          index: nextIndex(),
        });
        insert(textElement);
        bind(shape.id, { type: "text", id: textElement.id });
      }
    }

    for (const edge of edgeOrder) {
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

      const outside = outsideEdges.has(edge.id);
      const fromCenter = centerOf(fromBox);
      const toCenter = centerOf(toBox);
      const obstacles = shapeRects(store, new Set([fromId, toId]));
      const fromElement = store.get(fromId);
      const toElement = store.get(toId);
      const fromSchema = fromElement
        ? schemaTableData(fromElement)
        : undefined;
      const toSchema = toElement ? schemaTableData(toElement) : undefined;
      const schemaRoute = routeSchemaRelationship({
        edge,
        fromId,
        toId,
        fromBox,
        toBox,
        fromFields: fromSchema?.fields,
        toFields: toSchema?.fields,
        obstacles,
        routedSegments,
      });
      let points: Point[];
      let startFocus = 0.5;
      let endFocus = 0.5;

      if (schemaRoute) {
        points = schemaRoute.points;
        startFocus = schemaRoute.startFocus;
        endFocus = schemaRoute.endFocus;
      } else {
        let base: Point[];

        if (outside) {
          const routed = routeArrow(
            fromCenter,
            toCenter,
            obstacles,
            [fromBox, toBox],
            routedSegments,
            true,
          );
          base = dedupePoints(trimRoute(routed, fromBox, toBox));
        } else {
          base = routeArrow(
            arrowEndpoint(
              fromBox,
              shapeKindOf(store.get(fromId)),
              toCenter,
            ),
            arrowEndpoint(
              toBox,
              shapeKindOf(store.get(toId)),
              fromCenter,
            ),
            obstacles,
            [fromBox, toBox],
            routedSegments,
            false,
          );
        }

        const baseStart = base[0] ?? fromCenter;
        const baseEnd = base[base.length - 1] ?? toCenter;
        const baseStartSide = nearestSide(baseStart, fromBox);
        const baseEndSide = nearestSide(baseEnd, toBox);

        if (outside) {
          const bounds = boundingBox([...obstacles, fromBox, toBox]);
          const sides: PortSide[] = ["left", "right", "top", "bottom"];
          let best:
            | {
                points: Point[];
                score: number;
                startSide: PortSide;
                startValue: number;
                endSide: PortSide;
                endValue: number;
              }
            | null = null;

          for (const startSide of sides) {
            for (const endSide of sides) {
              const startValue = portValue(
                usedPorts,
                fromId,
                fromBox,
                startSide,
                portDesired(fromBox, startSide, baseStartSide, baseStart),
              );
              const endValue = portValue(
                usedPorts,
                toId,
                toBox,
                endSide,
                portDesired(toBox, endSide, baseEndSide, baseEnd),
              );
              const routed = routeArrow(
                portAnchor(fromBox, startSide, startValue),
                portAnchor(toBox, endSide, endValue),
                obstacles,
                [fromBox, toBox],
                routedSegments,
                true,
              );
              const score = routeScore(routed, routedSegments, bounds);

              if (!best || score < best.score) {
                best = {
                  points: routed,
                  score,
                  startSide,
                  startValue,
                  endSide,
                  endValue,
                };
              }
            }
          }

          if (best) {
            markPort(usedPorts, fromId, best.startSide, best.startValue);
            markPort(usedPorts, toId, best.endSide, best.endValue);
            points = best.points;
          } else {
            points = [baseStart, baseEnd];
          }
        } else {
          const startValue = portValue(
            usedPorts,
            fromId,
            fromBox,
            baseStartSide,
            baseStartSide === "left" || baseStartSide === "right"
              ? baseStart.y
              : baseStart.x,
          );
          const endValue = portValue(
            usedPorts,
            toId,
            toBox,
            baseEndSide,
            baseEndSide === "left" || baseEndSide === "right"
              ? baseEnd.y
              : baseEnd.x,
          );
          markPort(usedPorts, fromId, baseStartSide, startValue);
          markPort(usedPorts, toId, baseEndSide, endValue);
          points = routeArrow(
            portAnchor(fromBox, baseStartSide, startValue),
            portAnchor(toBox, baseEndSide, endValue),
            obstacles,
            [fromBox, toBox],
            routedSegments,
            false,
          );
        }
      }

      const arrow = createArrowElement({
        id: createId(),
        points,
        fromId,
        toId,
        startFocus,
        endFocus,
        index: nextIndex(),
        ...(schemaRoute
          ? {
              customData: schemaRelationshipCustomData({
                ...(edge.fromField ? { fromField: edge.fromField } : {}),
                ...(edge.toField ? { toField: edge.toField } : {}),
                ...(edge.cardinality
                  ? { cardinality: edge.cardinality }
                  : {}),
              }),
            }
          : {}),
      });
      idMap.set(edge.id, arrow.id);
      insert(arrow);
      routedSegments.push(...pointsToSegments(points));

      bind(fromId, { type: "arrow", id: arrow.id });
      bind(toId, { type: "arrow", id: arrow.id });

      const relationshipLabel = schemaRoute
        ? (sanitizeSchemaLabel(edge.label) ??
          [
            formatCardinality(edge.cardinality),
            edge.toField ? `| ${edge.toField}` : "",
          ]
            .filter(Boolean)
            .join(" "))
        : edge.label;

      if (relationshipLabel) {
        pendingLabels.push({
          arrowId: arrow.id,
          text: wrapEdgeText(relationshipLabel).text,
          points,
          fromBox,
          toBox,
        });
      }
    }
  }

  routedSegments.length = 0;
  for (const element of store.values()) {
    if (element.type === "arrow") {
      routedSegments.push(...arrowSegments(element));
    }
  }

  for (const pending of pendingLabels) {
    const target = boxOf(pending.arrowId) ?? {
      x: 0,
      y: 0,
      width: 0,
      height: 0,
    };
    const label = createTextElement({
      containerId: null,
      box: edgeLabelBox({
        arrow: target,
        points: pending.points,
        endpoints: [pending.fromBox, pending.toBox],
        text: pending.text,
        obstacles: obstacleRects(store),
        arrowSegments: routedSegments,
      }),
      text: pending.text,
      fontSize: EDGE_FONT_SIZE,
      index: nextIndex(),
      customData: edgeLabelCustomData(pending.arrowId),
    });
    insert(label);
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

  return {
    elements: result,
    idMap,
    skipped,
    layoutIssues: validateDiagramLayout(result),
  };
}

function insertSchemaTable(input: {
  id: string;
  box: Box;
  metrics: SchemaTableMetrics;
  name: string;
  fields: readonly SchemaField[];
  insert: (element: ExcalidrawElement) => void;
  nextIndex: () => FractionalIndex;
}): void {
  const { id, box, metrics, name, fields, insert, nextIndex } = input;
  const groupId = `wb_table_group_${id}`;
  const groupIds = [groupId];
  const padding = SCHEMA_PADDING_X;
  const body = createShapeElement(id, "rectangle", box, nextIndex(), {
    backgroundColor: "#ffffff",
    roughness: 0,
    groupIds,
    customData: schemaTableCustomData(name, fields),
  });
  insert(body);

  const headerBox: Box = {
    x: box.x,
    y: box.y,
    width: box.width,
    height: metrics.headerHeight,
  };
  const header = createShapeElement(
    createId(),
    "rectangle",
    headerBox,
    nextIndex(),
    {
      backgroundColor: "#f2ede4",
      roughness: 0,
      groupIds,
      customData: schemaDecorationCustomData(id),
    },
  );
  insert(header);

  const headerSize = measureText(name, SCHEMA_HEADER_FONT_SIZE);
  insert(
    createTextElement({
      containerId: null,
      box: {
        x: box.x + padding,
        y: box.y + (metrics.headerHeight - headerSize.height) / 2,
        width: Math.max(1, box.width - padding * 2),
        height: headerSize.height,
      },
      text: name,
      fontSize: SCHEMA_HEADER_FONT_SIZE,
      fontFamily: FONT_FAMILY,
      textAlign: "left",
      verticalAlign: "middle",
      groupIds,
      customData: schemaDecorationCustomData(id),
      index: nextIndex(),
    }),
  );

  const fieldText = metrics.fieldLines.join("\n");
  const fieldSize = measureText(fieldText, SCHEMA_FIELD_FONT_SIZE);
  insert(
    createTextElement({
      containerId: null,
      box: {
        x: box.x + padding,
        y: box.y + metrics.headerHeight + metrics.fieldTop,
        width: Math.max(1, box.width - padding * 2),
        height: fieldSize.height,
      },
      text: fieldText,
      fontSize: SCHEMA_FIELD_FONT_SIZE,
      fontFamily: 3,
      textAlign: "left",
      verticalAlign: "top",
      lineHeight: 1.25,
      groupIds,
      customData: schemaDecorationCustomData(id),
      index: nextIndex(),
    }),
  );
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
    const nextX = op.patch.x ?? current.x;
    const nextY = op.patch.y ?? current.y;
    const dx = nextX - current.x;
    const dy = nextY - current.y;

    store.set(
      elementId,
      withPatch(current, {
        ...(op.patch.x !== undefined ? { x: op.patch.x } : {}),
        ...(op.patch.y !== undefined ? { y: op.patch.y } : {}),
        ...(op.patch.width !== undefined ? { width: op.patch.width } : {}),
        ...(op.patch.height !== undefined ? { height: op.patch.height } : {}),
      }),
    );

    if (dx !== 0 || dy !== 0) {
      for (const decoration of store.values()) {
        if (schemaDecorationFor(decoration) === elementId) {
          store.set(
            decoration.id,
            withPatch(decoration, {
              x: decoration.x + dx,
              y: decoration.y + dy,
            }),
          );
        }
      }
    }
  }

  if (op.patch.text === undefined) {
    if (geometryChanged) {
      recenterBoundText(store, elementId);
    }
    return;
  }

  const boundText = findBoundText(store, elementId);
  const container = store.get(elementId);
  const nextText =
    container && isShapeKind(container.type)
      ? wrapNodeText(op.patch.text, container.width).text
      : op.patch.text;

  if (boundText) {
    const size = measureText(nextText);
    store.set(
      boundText.id,
      withPatch(boundText, {
        text: nextText,
        originalText: nextText,
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
    box: centeredTextBox(boxOfElement(current), nextText),
    text: nextText,
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

  for (let pass = 0; pass < 4; pass += 1) {
    let changed = false;

    for (const candidate of store.values()) {
      const decorationFor = schemaDecorationFor(candidate);

      if (decorationFor !== undefined && removeIds.has(decorationFor)) {
        if (!removeIds.has(candidate.id)) {
          removeIds.add(candidate.id);
          changed = true;
        }
      }

      if (candidate.type === "text") {
        const labelFor = edgeLabelArrowId(candidate);

        if (
          (candidate.containerId && removeIds.has(candidate.containerId)) ||
          (labelFor !== undefined && removeIds.has(labelFor))
        ) {
          if (!removeIds.has(candidate.id)) {
            removeIds.add(candidate.id);
            changed = true;
          }
        }
      }
      if (
        candidate.type === "arrow" &&
        ((candidate.startBinding?.elementId &&
          removeIds.has(candidate.startBinding.elementId)) ||
          (candidate.endBinding?.elementId &&
            removeIds.has(candidate.endBinding.elementId)))
      ) {
        if (!removeIds.has(candidate.id)) {
          removeIds.add(candidate.id);
          changed = true;
        }
      }
    }

    if (!changed) {
      break;
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
  options: {
    backgroundColor?: string;
    roughness?: number;
    groupIds?: string[];
    customData?: Record<string, unknown>;
  } = {},
): ExcalidrawElement {
  return {
    ...baseElement(
      id,
      box,
      index,
      options.customData,
      options.groupIds,
    ),
    type,
    ...(options.backgroundColor === undefined
      ? {}
      : { backgroundColor: options.backgroundColor }),
    ...(options.roughness === undefined
      ? {}
      : { roughness: options.roughness }),
  } as unknown as ExcalidrawElement;
}

function createTextElement(input: {
  containerId: string | null;
  box: Box;
  text: string;
  index: FractionalIndex;
  fontSize?: number;
  fontFamily?: number;
  textAlign?: "left" | "center" | "right";
  verticalAlign?: "top" | "middle" | "bottom";
  lineHeight?: number;
  customData?: Record<string, unknown>;
  groupIds?: string[];
}): ExcalidrawTextElement {
  return {
    ...baseElement(
      createId(),
      input.box,
      input.index,
      input.customData,
      input.groupIds,
    ),
    type: "text",
    text: input.text,
    fontSize: input.fontSize ?? NODE_FONT_SIZE,
    fontFamily: input.fontFamily ?? FONT_FAMILY,
    textAlign: input.textAlign ?? "center",
    verticalAlign: input.verticalAlign ?? "middle",
    containerId: input.containerId,
    originalText: input.text,
    autoResize: true,
    lineHeight: input.lineHeight ?? LINE_HEIGHT,
  } as unknown as ExcalidrawTextElement;
}

function createArrowElement(input: {
  id: string;
  points: Array<{ x: number; y: number }>;
  fromId: string;
  toId: string;
  index: FractionalIndex;
  startFocus?: number;
  endFocus?: number;
  customData?: Record<string, unknown>;
}): ExcalidrawElement {
  const xs = input.points.map((point) => point.x);
  const ys = input.points.map((point) => point.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);

  return {
    ...baseElement(
      input.id,
      {
        x: minX,
        y: minY,
        width: Math.max(...xs) - minX,
        height: Math.max(...ys) - minY,
      },
      input.index,
      input.customData,
    ),
    type: "arrow",
    points: input.points.map((point) => [point.x - minX, point.y - minY]),
    lastCommittedPoint: null,
    startBinding: {
      elementId: input.fromId,
      focus: input.startFocus ?? 0,
      gap: 4,
    },
    endBinding: {
      elementId: input.toId,
      focus: input.endFocus ?? 0,
      gap: 4,
    },
    startArrowhead: null,
    endArrowhead: "arrow",
    elbowed: false,
  } as unknown as ExcalidrawElement;
}

function baseElement(
  id: string,
  box: Box,
  index: FractionalIndex | null,
  customData?: Record<string, unknown>,
  groupIds: string[] = [],
) {
  return {
    id,
    x: box.x,
    y: box.y,
    width: box.width,
    height: box.height,
    ...(customData ? { customData } : {}),
    angle: 0,
    strokeColor: DEFAULT_STROKE,
    backgroundColor: "transparent",
    fillStyle: "solid",
    strokeWidth: 2,
    strokeStyle: "solid",
    roughness: 1,
    opacity: 100,
    groupIds,
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

function measureText(
  text: string,
  fontSize = NODE_FONT_SIZE,
): { width: number; height: number } {
  const lines = text.length === 0 ? [""] : text.split("\n");
  const longest = Math.max(...lines.map((line) => line.length));

  return {
    width: Math.max(fontSize, longest * fontSize * TEXT_WIDTH_RATIO),
    height: Math.max(
      fontSize * LINE_HEIGHT,
      lines.length * fontSize * LINE_HEIGHT,
    ),
  };
}

function centeredTextBox(
  container: Box,
  text: string,
  fontSize = NODE_FONT_SIZE,
): Box {
  const size = measureText(text, fontSize);

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

/**
 * The point on the shape's border in the direction of `toward`, so arrows
 * start and end at the edge of a shape instead of its center.
 */
function arrowEndpoint(
  box: Box,
  kind: ShapeKind,
  toward: { x: number; y: number },
): { x: number; y: number } {
  const center = centerOf(box);
  const dx = toward.x - center.x;
  const dy = toward.y - center.y;

  if (dx === 0 && dy === 0) {
    return center;
  }

  const rx = box.width / 2;
  const ry = box.height / 2;

  if (rx <= 0 || ry <= 0) {
    return center;
  }

  let scale: number;

  if (kind === "ellipse") {
    scale = 1 / Math.sqrt((dx * dx) / (rx * rx) + (dy * dy) / (ry * ry));
  } else if (kind === "diamond") {
    scale = 1 / (Math.abs(dx) / rx + Math.abs(dy) / ry);
  } else {
    const scaleX = dx === 0 ? Infinity : rx / Math.abs(dx);
    const scaleY = dy === 0 ? Infinity : ry / Math.abs(dy);

    scale = Math.min(scaleX, scaleY);
  }

  return {
    x: center.x + dx * scale,
    y: center.y + dy * scale,
  };
}

function shapeKindOf(element: ExcalidrawElement | undefined): ShapeKind {
  return element && isShapeKind(element.type) ? element.type : "rectangle";
}

function shapeRects(
  store: Store,
  excludeIds: ReadonlySet<string> = new Set(),
): Box[] {
  const rects: Box[] = [];

  for (const [id, element] of store) {
    if (
      !excludeIds.has(id) &&
      !isSchemaDecoration(element) &&
      SHAPE_KINDS.includes(element.type)
    ) {
      rects.push(boxOfElement(element));
    }
  }

  return rects;
}

function obstacleRects(
  store: Store,
  excludeIds: ReadonlySet<string> = new Set(),
): Box[] {
  const rects: Box[] = [];

  for (const [id, element] of store) {
    if (
      !excludeIds.has(id) &&
      !isSchemaDecoration(element) &&
      (element.type === "text" || SHAPE_KINDS.includes(element.type))
    ) {
      rects.push(boxOfElement(element));
    }
  }

  return rects;
}

const ROUTE_MARGIN = 30;

/**
 * Routes an edge around unrelated shapes. Tries straight, L, Z and lane
 * routes around the blocking shapes, then picks the shortest clear path.
 */
function findBackEdgeIds(edges: readonly NewEdge[]): Set<string> {
  const adjacency = new Map<string, Array<{ to: string; id: string }>>();
  const nodes: string[] = [];

  for (const edge of edges) {
    if (!adjacency.has(edge.from)) {
      adjacency.set(edge.from, []);
      nodes.push(edge.from);
    }
    if (!adjacency.has(edge.to)) {
      adjacency.set(edge.to, []);
      nodes.push(edge.to);
    }
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
      } else if (status === 0) {
        visit(next.to);
      }
    }

    state.set(node, 2);
  };

  for (const node of nodes) {
    if ((state.get(node) ?? 0) === 0) {
      visit(node);
    }
  }

  return back;
}

function rankNodes(
  edges: readonly NewEdge[],
  backEdges: Set<string>,
): Map<string, number> {
  const ranks = new Map<string, number>();
  const nodes: string[] = [];

  for (const edge of edges) {
    if (!ranks.has(edge.from)) {
      ranks.set(edge.from, 0);
      nodes.push(edge.from);
    }
    if (!ranks.has(edge.to)) {
      ranks.set(edge.to, 0);
      nodes.push(edge.to);
    }
  }

  for (let pass = 0; pass < nodes.length; pass += 1) {
    let changed = false;

    for (const edge of edges) {
      if (backEdges.has(edge.id)) {
        continue;
      }

      const next = (ranks.get(edge.from) ?? 0) + 1;
      if (next > (ranks.get(edge.to) ?? 0)) {
        ranks.set(edge.to, next);
        changed = true;
      }
    }

    if (!changed) {
      break;
    }
  }

  return ranks;
}

function routeArrow(
  from: { x: number; y: number },
  to: { x: number; y: number },
  obstacles: Box[],
  endpoints: Box[],
  routed: Segment[],
  preferOutside: boolean,
): Point[] {
  const allRects = [...obstacles, ...endpoints];
  const horizontal = Math.abs(to.x - from.x) >= Math.abs(to.y - from.y);
  const distance = horizontal
    ? Math.abs(to.x - from.x)
    : Math.abs(to.y - from.y);
  const drift = horizontal
    ? Math.abs(to.y - from.y)
    : Math.abs(to.x - from.x);
  const backward =
    (horizontal ? to.x < from.x - 1 : to.y < from.y - 1) &&
    distance > 350 &&
    drift < 120;
  const inflated = obstacles.map((box) => inflateBox(box, 8));
  const endpointZones = endpoints.map((box) => inflateBox(box, 8));

  const candidates: Array<{ points: Point[]; score: number }> = [];
  const consider = (points: Point[]) => {
    if (!segmentsClear(points, inflated)) {
      return;
    }

    if (preferOutside && !routeClearsEndpoints(points, endpointZones)) {
      return;
    }

    candidates.push({
      points,
      score: routeScore(
        points,
        routed,
        preferOutside ? (boundingBox(allRects) ?? null) : null,
      ),
    });
  };

  const aligned =
    Math.abs(to.x - from.x) <= 1 || Math.abs(to.y - from.y) <= 1;

  if (aligned) {
    consider([from, to]);
  }
  consider([from, { x: to.x, y: from.y }, to]);
  consider([from, { x: from.x, y: to.y }, to]);
  consider([
    from,
    { x: (from.x + to.x) / 2, y: from.y },
    { x: (from.x + to.x) / 2, y: to.y },
    to,
  ]);
  consider([
    from,
    { x: from.x, y: (from.y + to.y) / 2 },
    { x: to.x, y: (from.y + to.y) / 2 },
    to,
  ]);

  const union = boundingBox(allRects);
  const offsets = [0, 30, 60, 90];

  if (union && (backward || preferOutside)) {
    const bottom = union.y + union.height + ROUTE_MARGIN;
    const top = union.y - ROUTE_MARGIN;
    const left = union.x - ROUTE_MARGIN;
    const right = union.x + union.width + ROUTE_MARGIN;

    if (backward) {
      if (horizontal) {
        for (const offset of offsets) {
          consider([
            from,
            { x: from.x, y: bottom + offset },
            { x: to.x, y: bottom + offset },
            to,
          ]);
          consider([
            from,
            { x: from.x, y: top - offset },
            { x: to.x, y: top - offset },
            to,
          ]);
        }
      } else {
        for (const offset of offsets) {
          consider([
            from,
            { x: left - offset, y: from.y },
            { x: left - offset, y: to.y },
            to,
          ]);
          consider([
            from,
            { x: right + offset, y: from.y },
            { x: right + offset, y: to.y },
            to,
          ]);
        }
      }
    }

    for (const offset of offsets) {
      consider([
        from,
        { x: from.x, y: bottom + offset },
        { x: to.x, y: bottom + offset },
        to,
      ]);
      consider([
        from,
        { x: from.x, y: top - offset },
        { x: to.x, y: top - offset },
        to,
      ]);
      consider([
        from,
        { x: left - offset, y: from.y },
        { x: left - offset, y: to.y },
        to,
      ]);
      consider([
        from,
        { x: right + offset, y: from.y },
        { x: right + offset, y: to.y },
        to,
      ]);

      if (preferOutside) {
        const laneTop = top - offset;
        const laneBottom = bottom + offset;
        const laneLeft = left - offset;
        const laneRight = right + offset;

        consider([
          from,
          { x: from.x, y: laneTop },
          { x: laneLeft, y: laneTop },
          { x: laneLeft, y: to.y },
          to,
        ]);
        consider([
          from,
          { x: from.x, y: laneTop },
          { x: laneRight, y: laneTop },
          { x: laneRight, y: to.y },
          to,
        ]);
        consider([
          from,
          { x: from.x, y: laneBottom },
          { x: laneLeft, y: laneBottom },
          { x: laneLeft, y: to.y },
          to,
        ]);
        consider([
          from,
          { x: from.x, y: laneBottom },
          { x: laneRight, y: laneBottom },
          { x: laneRight, y: to.y },
          to,
        ]);
        consider([
          from,
          { x: laneLeft, y: from.y },
          { x: laneLeft, y: laneTop },
          { x: to.x, y: laneTop },
          to,
        ]);
        consider([
          from,
          { x: laneRight, y: from.y },
          { x: laneRight, y: laneTop },
          { x: to.x, y: laneTop },
          to,
        ]);
        consider([
          from,
          { x: laneLeft, y: from.y },
          { x: laneLeft, y: laneBottom },
          { x: to.x, y: laneBottom },
          to,
        ]);
        consider([
          from,
          { x: laneRight, y: from.y },
          { x: laneRight, y: laneBottom },
          { x: to.x, y: laneBottom },
          to,
        ]);
      }
    }
  }

  const blockers = inflated
    .filter((box) => segmentIntersectsBox(from, to, box, 0))
    .slice(0, 4);

  for (const box of blockers) {
    for (const laneX of [
      box.x - ROUTE_MARGIN,
      box.x + box.width + ROUTE_MARGIN,
    ]) {
      consider([
        from,
        { x: laneX, y: from.y },
        { x: laneX, y: to.y },
        to,
      ]);
    }

    for (const laneY of [
      box.y - ROUTE_MARGIN,
      box.y + box.height + ROUTE_MARGIN,
    ]) {
      consider([
        from,
        { x: from.x, y: laneY },
        { x: to.x, y: laneY },
        to,
      ]);
    }
  }

  if (candidates.length > 0) {
    const clean = candidates.filter(
      (candidate) => !polylineOverlaps(candidate.points, routed),
    );
    const pool = clean.length > 0 ? clean : candidates;

    pool.sort((a, b) => a.score - b.score);

    return dedupePoints(pool[0]?.points ?? [from, to]);
  }

  const gridRoute = findOrthogonalRoute(from, to, inflated, routed);

  if (gridRoute) {
    return dedupePoints(gridRoute);
  }

  const blocker = obstacles.find((box) =>
    segmentIntersectsBox(from, to, box, 8),
  );

  if (!blocker) {
    return [from, to];
  }

  const left = blocker.x - ROUTE_MARGIN;
  const right = blocker.x + blocker.width + ROUTE_MARGIN;
  const top = blocker.y - ROUTE_MARGIN;
  const bottom = blocker.y + blocker.height + ROUTE_MARGIN;

  if (Math.abs(to.x - from.x) >= Math.abs(to.y - from.y)) {
    const lineY = (from.y + to.y) / 2;
    const detourY =
      Math.abs(lineY - top) <= Math.abs(bottom - lineY) ? top : bottom;

    if (to.x >= from.x) {
      return [
        from,
        { x: left, y: from.y },
        { x: left, y: detourY },
        { x: right, y: detourY },
        { x: right, y: to.y },
        to,
      ];
    }

    return [
      from,
      { x: right, y: from.y },
      { x: right, y: detourY },
      { x: left, y: detourY },
      { x: left, y: to.y },
      to,
    ];
  }

  const lineX = (from.x + to.x) / 2;
  const detourX =
    Math.abs(lineX - left) <= Math.abs(right - lineX) ? left : right;

  if (to.y >= from.y) {
    return [
      from,
      { x: from.x, y: top },
      { x: detourX, y: top },
      { x: detourX, y: bottom },
      { x: to.x, y: bottom },
      to,
    ];
  }

  return [
    from,
    { x: from.x, y: bottom },
    { x: detourX, y: bottom },
    { x: detourX, y: top },
    { x: to.x, y: top },
    to,
  ];
}

function routeSchemaRelationship(input: {
  edge: NewEdge;
  fromId: string;
  toId: string;
  fromBox: Box;
  toBox: Box;
  fromFields?: SchemaField[];
  toFields?: SchemaField[];
  obstacles: Box[];
  routedSegments: Segment[];
}): { points: Point[]; startFocus: number; endFocus: number } | null {
  const { edge, fromFields, toFields } = input;

  if (!edge.fromField || !edge.toField || !fromFields || !toFields) {
    return null;
  }

  const fromIndex = findFieldIndex(fromFields, edge.fromField);
  const toIndex = findFieldIndex(toFields, edge.toField);

  if (fromIndex < 0 || toIndex < 0) {
    return null;
  }

  const fromY = schemaRowCenterY(input.fromBox.y, fromIndex);
  const toY = schemaRowCenterY(input.toBox.y, toIndex);

  if (input.fromId === input.toId) {
    const side: PortSide = "right";
    const start = portAnchor(input.fromBox, side, fromY);
    const end = portAnchor(input.toBox, side, toY);
    const lane = input.fromBox.x + input.fromBox.width + 56;

    const points =
      Math.abs(fromY - toY) < 1
        ? [
            start,
            { x: lane, y: fromY },
            { x: lane, y: fromY - 28 },
            { x: lane + 28, y: fromY - 28 },
            { x: lane + 28, y: toY + 28 },
            { x: lane, y: toY + 28 },
            { x: lane, y: toY },
            end,
          ]
        : [start, { x: lane, y: fromY }, { x: lane, y: toY }, end];

    return {
      points,
      startFocus: verticalFocus(input.fromBox, fromY),
      endFocus: verticalFocus(input.toBox, toY),
    };
  }

  const fromCenter = centerOf(input.fromBox);
  const toCenter = centerOf(input.toBox);
  const dx = toCenter.x - fromCenter.x;
  const horizontal = Math.abs(dx) >= 120;
  const startSide: PortSide = horizontal
    ? dx >= 0
      ? "right"
      : "left"
    : "right";
  const endSide: PortSide = horizontal
    ? dx >= 0
      ? "left"
      : "right"
    : "right";
  const start = portAnchor(input.fromBox, startSide, fromY);
  const end = portAnchor(input.toBox, endSide, toY);
  const stub = 24;
  const startStub = {
    x: start.x + (startSide === "right" ? stub : -stub),
    y: start.y,
  };
  const endStub = {
    x: end.x + (endSide === "right" ? stub : -stub),
    y: end.y,
  };
  const obstacles = [...input.obstacles, input.fromBox, input.toBox];
  const routed =
    findOrthogonalRoute(
      startStub,
      endStub,
      obstacles,
      input.routedSegments,
    ) ??
    routeArrow(
      startStub,
      endStub,
      obstacles,
      [],
      input.routedSegments,
      false,
    );

  return {
    points: dedupePoints([start, ...routed, end]),
    startFocus: verticalFocus(input.fromBox, fromY),
    endFocus: verticalFocus(input.toBox, toY),
  };
}

function findFieldIndex(fields: readonly SchemaField[], name: string): number {
  const normalized = name.trim().toLowerCase();

  return fields.findIndex(
    (field) => field.name.trim().toLowerCase() === normalized,
  );
}

function sanitizeSchemaLabel(label: string | undefined): string | undefined {
  const cleaned = label
    ?.replace(/[\u00b7\ufffd]/g, "|")
    .replace(/\u2192/g, "->")
    .replace(/\s+/g, " ")
    .trim();

  return cleaned && cleaned.length > 0 ? cleaned : undefined;
}

function verticalFocus(box: Box, value: number): number {
  if (box.height <= 0) {
    return 0.5;
  }

  return Math.max(0.02, Math.min(0.98, (value - box.y) / box.height));
}

type GridNeighbor = {
  index: number;
  direction: 1 | 2;
  distance: number;
  length: number;
};

type RouteState = {
  key: string;
  pointIndex: number;
  direction: 0 | 1 | 2;
  cost: number;
  estimate: number;
  sequence: number;
};

/**
 * A visibility-grid fallback. When the heuristic candidates are all blocked,
 * search an orthogonal grid built from obstacle boundaries so a clear route is
 * still found instead of falling back to a line through nodes.
 */
function findOrthogonalRoute(
  from: Point,
  to: Point,
  obstacles: Box[],
  routed: Segment[],
): Point[] | null {
  const points: Point[] = [];
  const pointIndex = new Map<string, number>();
  const xs = new Set<number>([from.x, to.x]);
  const ys = new Set<number>([from.y, to.y]);
  const union = boundingBox(obstacles);
  const margin = 4;

  for (const box of obstacles) {
    xs.add(box.x - margin);
    xs.add(box.x + box.width + margin);
    ys.add(box.y - margin);
    ys.add(box.y + box.height + margin);
  }

  if (union) {
    xs.add(union.x - ROUTE_MARGIN);
    xs.add(union.x + union.width + ROUTE_MARGIN);
    ys.add(union.y - ROUTE_MARGIN);
    ys.add(union.y + union.height + ROUTE_MARGIN);
  }

  const addPoint = (point: Point): number | undefined => {
    const key = pointKey(point);
    const existing = pointIndex.get(key);

    if (existing !== undefined) {
      return existing;
    }

    if (obstacles.some((box) => pointInBox(point, box))) {
      return undefined;
    }

    const index = points.length;
    points.push(point);
    pointIndex.set(key, index);
    return index;
  };

  addPoint(from);
  addPoint(to);

  for (const y of [...ys].sort((a, b) => a - b)) {
    for (const x of [...xs].sort((a, b) => a - b)) {
      addPoint({ x, y });
    }
  }

  const fromIndex = pointIndex.get(pointKey(from));
  const toIndex = pointIndex.get(pointKey(to));

  if (fromIndex === undefined || toIndex === undefined) {
    return null;
  }

  const rows = new Map<number, number[]>();
  const columns = new Map<number, number[]>();

  for (let index = 0; index < points.length; index += 1) {
    const point = points[index];

    if (!point) {
      continue;
    }

    const row = rows.get(point.y) ?? [];
    row.push(index);
    rows.set(point.y, row);

    const column = columns.get(point.x) ?? [];
    column.push(index);
    columns.set(point.x, column);
  }

  const neighbors = new Map<number, GridNeighbor[]>();
  const linkVisible = (indices: number[], direction: 1 | 2) => {
    for (let first = 0; first < indices.length - 1; first += 1) {
      const firstIndex = indices[first];
      const secondIndex = indices[first + 1];

      if (firstIndex === undefined || secondIndex === undefined) {
        continue;
      }

      const a = points[firstIndex];
      const b = points[secondIndex];

      if (!a || !b || !segmentsClear([a, b], obstacles)) {
        continue;
      }

      const distance = Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
      addNeighbor(neighbors, firstIndex, {
        index: secondIndex,
        direction,
        distance,
        length: distance,
      });
      addNeighbor(neighbors, secondIndex, {
        index: firstIndex,
        direction,
        distance,
        length: distance,
      });
    }
  };

  for (const indices of rows.values()) {
    indices.sort((a, b) => (points[a]?.x ?? 0) - (points[b]?.x ?? 0));
    linkVisible(indices, 1);
  }

  for (const indices of columns.values()) {
    indices.sort((a, b) => (points[a]?.y ?? 0) - (points[b]?.y ?? 0));
    linkVisible(indices, 2);
  }

  const startState: RouteState = {
    key: stateKey(fromIndex, 0),
    pointIndex: fromIndex,
    direction: 0,
    cost: 0,
    estimate: manhattanDistance(from, to),
    sequence: 0,
  };
  const open: RouteState[] = [startState];
  const bestCost = new Map<string, number>([[startState.key, 0]]);
  const previous = new Map<string, string>();
  const statePoints = new Map<string, Point>([[startState.key, from]]);
  let sequence = 1;
  let goalKey: string | null = null;
  let expansions = 0;

  while (open.length > 0 && expansions < 20000) {
    open.sort(
      (a, b) => a.cost + a.estimate - (b.cost + b.estimate) || a.sequence - b.sequence,
    );
    const current = open.shift();

    if (!current) {
      break;
    }

    if (current.pointIndex === toIndex) {
      goalKey = current.key;
      break;
    }

    expansions += 1;
    const currentPoint = points[current.pointIndex];

    if (!currentPoint) {
      continue;
    }

    for (const neighbor of neighbors.get(current.pointIndex) ?? []) {
      const nextPoint = points[neighbor.index];

      if (!nextPoint) {
        continue;
      }

      const bendCost =
        current.direction !== 0 && current.direction !== neighbor.direction
          ? 36
          : 0;
      const crossingCost =
        countRouteCrossings(currentPoint, nextPoint, routed) * 220;
      const nextCost = current.cost + neighbor.distance + bendCost + crossingCost;
      const nextKey = stateKey(neighbor.index, neighbor.direction);
      const known = bestCost.get(nextKey);

      if (known !== undefined && known <= nextCost) {
        continue;
      }

      bestCost.set(nextKey, nextCost);
      previous.set(nextKey, current.key);
      statePoints.set(nextKey, nextPoint);
      open.push({
        key: nextKey,
        pointIndex: neighbor.index,
        direction: neighbor.direction,
        cost: nextCost,
        estimate: manhattanDistance(nextPoint, to),
        sequence,
      });
      sequence += 1;
    }
  }

  if (!goalKey) {
    return null;
  }

  const route: Point[] = [];
  let cursor: string | undefined = goalKey;

  while (cursor) {
    const point = statePoints.get(cursor);

    if (point) {
      route.push(point);
    }

    cursor = previous.get(cursor);
  }

  return dedupePoints(route.reverse());
}

function addNeighbor(
  neighbors: Map<number, GridNeighbor[]>,
  index: number,
  neighbor: GridNeighbor,
): void {
  const list = neighbors.get(index);

  if (list) {
    list.push(neighbor);
  } else {
    neighbors.set(index, [neighbor]);
  }
}

function pointKey(point: Point): string {
  return `${Math.round(point.x * 10) / 10}:${Math.round(point.y * 10) / 10}`;
}

function stateKey(index: number, direction: 0 | 1 | 2): string {
  return `${index}:${direction}`;
}

function manhattanDistance(a: Point, b: Point): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

function countRouteCrossings(a: Point, b: Point, routed: Segment[]): number {
  let crossings = 0;

  for (const segment of routed) {
    if (
      (Math.abs(a.x - segment.a.x) < 0.5 && Math.abs(a.y - segment.a.y) < 0.5) ||
      (Math.abs(a.x - segment.b.x) < 0.5 && Math.abs(a.y - segment.b.y) < 0.5) ||
      (Math.abs(b.x - segment.a.x) < 0.5 && Math.abs(b.y - segment.a.y) < 0.5) ||
      (Math.abs(b.x - segment.b.x) < 0.5 && Math.abs(b.y - segment.b.y) < 0.5)
    ) {
      continue;
    }

    if (segmentsIntersect(a, b, segment.a, segment.b)) {
      crossings += 1;
    }
  }

  return crossings;
}

function inflateBox(box: Box, margin: number): Box {
  return {
    x: box.x - margin,
    y: box.y - margin,
    width: box.width + margin * 2,
    height: box.height + margin * 2,
  };
}

function segmentsClear(
  points: Array<{ x: number; y: number }>,
  obstacles: Box[],
): boolean {
  for (let index = 0; index < points.length - 1; index += 1) {
    const from = points[index];
    const to = points[index + 1];

    if (!from || !to) {
      return false;
    }

    for (const obstacle of obstacles) {
      if (segmentIntersectsBox(from, to, obstacle, 0)) {
        return false;
      }
    }
  }

  return true;
}

function polylineLength(points: Array<{ x: number; y: number }>): number {
  let length = 0;

  for (let index = 0; index < points.length - 1; index += 1) {
    const from = points[index];
    const to = points[index + 1];

    if (from && to) {
      length += Math.abs(to.x - from.x) + Math.abs(to.y - from.y);
    }
  }

  return length;
}

function pointsToSegments(points: Point[]): Segment[] {
  const segments: Segment[] = [];

  for (let index = 0; index < points.length - 1; index += 1) {
    const a = points[index];
    const b = points[index + 1];
    if (a && b) {
      segments.push({ a, b });
    }
  }

  return segments;
}

function arrowSegments(element: ExcalidrawElement): Segment[] {
  if (element.type !== "arrow") {
    return [];
  }

  return pointsToSegments(
    element.points.map(([x, y]) => ({ x: element.x + x, y: element.y + y })),
  );
}

function portValue(
  usedPorts: Map<string, Map<PortSide, number[]>>,
  nodeId: string,
  box: Box,
  side: PortSide,
  desired: number,
): number {
  const vertical = side === "left" || side === "right";
  const start = vertical ? box.y : box.x;
  const length = vertical ? box.height : box.width;
  const low = start + 12;
  const high = start + length - 12;
  const clamp = (value: number) =>
    length <= 24 ? start + length / 2 : Math.max(low, Math.min(high, value));
  const ports = usedPorts.get(nodeId)?.get(side) ?? [];
  let value = clamp(desired);

  for (const offset of [0, -24, 24, -48, 48, -72, 72]) {
    const candidate = clamp(desired + offset);
    if (ports.every((port) => Math.abs(port - candidate) > 10)) {
      value = candidate;
      break;
    }
  }

  return value;
}

function markPort(
  usedPorts: Map<string, Map<PortSide, number[]>>,
  nodeId: string,
  side: PortSide,
  value: number,
): void {
  let nodePorts = usedPorts.get(nodeId);

  if (!nodePorts) {
    nodePorts = new Map();
    usedPorts.set(nodeId, nodePorts);
  }

  const ports = nodePorts.get(side) ?? [];
  if (!ports.some((port) => Math.abs(port - value) <= 0.5)) {
    ports.push(value);
  }
  nodePorts.set(side, ports);
}

function portAnchor(box: Box, side: PortSide, value: number): Point {
  if (side === "left" || side === "right") {
    return { x: side === "left" ? box.x : box.x + box.width, y: value };
  }

  return { x: value, y: side === "top" ? box.y : box.y + box.height };
}

function portDesired(
  box: Box,
  side: PortSide,
  baseSide: PortSide,
  basePoint: Point,
): number {
  const vertical = side === "left" || side === "right";

  if (side === baseSide) {
    return vertical ? basePoint.y : basePoint.x;
  }

  return vertical ? box.y + box.height / 2 : box.x + box.width / 2;
}

function nearestSide(point: Point, box: Box): "left" | "right" | "top" | "bottom" {
  const distances = [
    { side: "left" as const, distance: Math.abs(point.x - box.x) },
    {
      side: "right" as const,
      distance: Math.abs(point.x - (box.x + box.width)),
    },
    { side: "top" as const, distance: Math.abs(point.y - box.y) },
    {
      side: "bottom" as const,
      distance: Math.abs(point.y - (box.y + box.height)),
    },
  ];

  return distances.reduce((best, candidate) =>
    candidate.distance < best.distance ? candidate : best,
  ).side;
}

function routeScore(
  points: Point[],
  routed: Segment[],
  interior: Box | null,
): number {
  const segments = pointsToSegments(points);
  let crossings = 0;
  let overlaps = 0;
  let interiorPenalty = 0;
  let outsideBonus = 0;

  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index];
    if (!segment) {
      continue;
    }

    for (const other of routed) {
      if (segmentsIntersect(segment.a, segment.b, other.a, other.b)) {
        crossings += 1;
      } else if (segmentsOverlap(segment, other)) {
        overlaps += 1;
      }
    }

    if (interior && index > 0 && index < segments.length - 1) {
      const length =
        Math.abs(segment.b.x - segment.a.x) +
        Math.abs(segment.b.y - segment.a.y);
      const mid = {
        x: (segment.a.x + segment.b.x) / 2,
        y: (segment.a.y + segment.b.y) / 2,
      };

      if (length > 150 && pointInBox(mid, interior)) {
        interiorPenalty += 1200;
      }
    }
  }

  if (interior) {
    for (const segment of segments) {
      const horizontal = Math.abs(segment.a.y - segment.b.y) <= 1;
      const vertical = Math.abs(segment.a.x - segment.b.x) <= 1;
      const lane =
        (horizontal &&
          (segment.a.y < interior.y ||
            segment.a.y > interior.y + interior.height)) ||
        (vertical &&
          (segment.a.x < interior.x ||
            segment.a.x > interior.x + interior.width));

      if (lane) {
        outsideBonus = -1600;
        break;
      }
    }
  }

  return (
    polylineLength(points) +
    Math.max(0, points.length - 2) * 25 +
    crossings * 1500 +
    overlaps * 900 +
    interiorPenalty +
    outsideBonus
  );
}

function pointInBox(point: Point, box: Box): boolean {
  return (
    point.x > box.x &&
    point.x < box.x + box.width &&
    point.y > box.y &&
    point.y < box.y + box.height
  );
}

function routeClearsEndpoints(points: Point[], zones: Box[]): boolean {
  const segments = pointsToSegments(points);

  for (let index = 0; index < segments.length; index += 1) {
    if (index === 0 || index === segments.length - 1) {
      continue;
    }

    const segment = segments[index];
    if (
      segment &&
      zones.some((zone) => segmentIntersectsBox(segment.a, segment.b, zone, 0))
    ) {
      return false;
    }
  }

  for (let index = 1; index < points.length - 1; index += 1) {
    const point = points[index];
    if (point && zones.some((zone) => pointInBox(point, zone))) {
      return false;
    }
  }

  return true;
}

function dedupePoints(points: Point[]): Point[] {
  const result: Point[] = [];

  for (const point of points) {
    const previous = result[result.length - 1];
    if (
      !previous ||
      Math.abs(previous.x - point.x) > 0.5 ||
      Math.abs(previous.y - point.y) > 0.5
    ) {
      result.push(point);
    }
  }

  return result;
}

function trimRoute(points: Point[], fromBox: Box, toBox: Box): Point[] {
  const [first, second] = points;
  const last = points[points.length - 1];
  const beforeLast = points[points.length - 2];

  if (!first || !second || !last || !beforeLast) {
    return points;
  }

  const start = { ...first };
  const dx = second.x - first.x;
  const dy = second.y - first.y;

  if (Math.abs(dx) >= Math.abs(dy)) {
    start.x = dx >= 0 ? fromBox.x + fromBox.width : fromBox.x;
  } else {
    start.y = dy >= 0 ? fromBox.y + fromBox.height : fromBox.y;
  }

  const end = { ...last };
  const ex = last.x - beforeLast.x;
  const ey = last.y - beforeLast.y;

  if (Math.abs(ex) >= Math.abs(ey)) {
    end.x = ex >= 0 ? toBox.x : toBox.x + toBox.width;
  } else {
    end.y = ey >= 0 ? toBox.y : toBox.y + toBox.height;
  }

  return [start, ...points.slice(1, -1), end];
}

function polylineOverlaps(points: Point[], routed: Segment[]): boolean {
  for (const segment of pointsToSegments(points)) {
    for (const other of routed) {
      if (segmentsOverlap(segment, other)) {
        return true;
      }
    }
  }

  return false;
}

function segmentsOverlap(one: Segment, other: Segment): boolean {
  const EPS = 2;
  const SAME_LANE = 6;
  const oneHorizontal = Math.abs(one.a.y - one.b.y) <= EPS;
  const otherHorizontal = Math.abs(other.a.y - other.b.y) <= EPS;

  if (
    oneHorizontal &&
    otherHorizontal &&
    Math.abs(one.a.y - other.a.y) <= SAME_LANE
  ) {
    return rangesOverlap(one.a.x, one.b.x, other.a.x, other.b.x);
  }

  const oneVertical = Math.abs(one.a.x - one.b.x) <= EPS;
  const otherVertical = Math.abs(other.a.x - other.b.x) <= EPS;

  if (
    oneVertical &&
    otherVertical &&
    Math.abs(one.a.x - other.a.x) <= SAME_LANE
  ) {
    return rangesOverlap(one.a.y, one.b.y, other.a.y, other.b.y);
  }

  return false;
}

function rangesOverlap(
  aStart: number,
  aEnd: number,
  bStart: number,
  bEnd: number,
): boolean {
  const aMin = Math.min(aStart, aEnd);
  const aMax = Math.max(aStart, aEnd);
  const bMin = Math.min(bStart, bEnd);
  const bMax = Math.max(bStart, bEnd);

  return Math.min(aMax, bMax) - Math.max(aMin, bMin) > 8;
}

function segmentIntersectsBox(
  a: { x: number; y: number },
  b: { x: number; y: number },
  box: Box,
  margin: number,
): boolean {
  const left = box.x - margin;
  const right = box.x + box.width + margin;
  const top = box.y - margin;
  const bottom = box.y + box.height + margin;
  const inside = (point: { x: number; y: number }) =>
    point.x >= left &&
    point.x <= right &&
    point.y >= top &&
    point.y <= bottom;

  if (inside(a) || inside(b)) {
    return true;
  }

  const corners = [
    { x: left, y: top },
    { x: right, y: top },
    { x: right, y: bottom },
    { x: left, y: bottom },
  ];

  for (let index = 0; index < corners.length; index += 1) {
    const current = corners[index];
    const next = corners[(index + 1) % corners.length];

    if (current && next && segmentsIntersect(a, b, current, next)) {
      return true;
    }
  }

  return false;
}

function segmentsIntersect(
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
  const first = orientation(a, b, c);
  const second = orientation(a, b, d);
  const third = orientation(c, d, a);
  const fourth = orientation(c, d, b);
  const epsilon = 1e-6;
  const straddles = (left: number, right: number) =>
    (left > epsilon && right < -epsilon) ||
    (left < -epsilon && right > epsilon);

  return straddles(first, second) && straddles(third, fourth);
}

/**
 * Places an edge label near the arrow but clear of shapes and other labels:
 * center first, then around the endpoint shapes, before falling back to center.
 */
function edgeLabelBox(input: {
  arrow: Box;
  points: Array<{ x: number; y: number }>;
  endpoints: Box[];
  text: string;
  obstacles: Box[];
  arrowSegments: Segment[];
}): Box {
  const size = measureText(input.text, EDGE_FONT_SIZE);
  const centerX = input.arrow.x + input.arrow.width / 2;
  const centerY = input.arrow.y + input.arrow.height / 2;
  const union = boundingBox(input.endpoints) ?? input.arrow;
  const candidates: Array<{ x: number; y: number }> = [];

  for (let index = 0; index < input.points.length - 1; index += 1) {
    const from = input.points[index];
    const to = input.points[index + 1];

    if (!from || !to) {
      continue;
    }

    const horizontalSegment =
      Math.abs(to.x - from.x) >= Math.abs(to.y - from.y);

    for (const fraction of [0.5, 0.3, 0.7]) {
      const midX = from.x + (to.x - from.x) * fraction;
      const midY = from.y + (to.y - from.y) * fraction;

      for (const side of [-1, 1]) {
        candidates.push(
          horizontalSegment
            ? { x: midX, y: midY + side * (size.height / 2 + LABEL_GAP) }
            : { x: midX + side * (size.width / 2 + LABEL_GAP), y: midY },
        );
      }

      for (const side of [-1, 1]) {
        candidates.push(
          horizontalSegment
            ? { x: midX, y: midY + side * (size.height / 2 + LABEL_GAP * 3) }
            : { x: midX + side * (size.width / 2 + LABEL_GAP * 3), y: midY },
        );
      }

      for (const side of [-1, 1]) {
        candidates.push(
          horizontalSegment
            ? { x: midX, y: midY + side * (size.height / 2 + LABEL_GAP * 6) }
            : { x: midX + side * (size.width / 2 + LABEL_GAP * 6), y: midY },
        );
      }
    }
  }

  candidates.push(
    { x: centerX, y: centerY },
    { x: centerX, y: union.y - size.height / 2 - LABEL_GAP },
    { x: centerX, y: union.y + union.height + size.height / 2 + LABEL_GAP },
    { x: union.x - size.width / 2 - LABEL_GAP, y: centerY },
    { x: union.x + union.width + size.width / 2 + LABEL_GAP, y: centerY },
  );

  const obstaclesUnion = boundingBox(input.obstacles);

  if (obstaclesUnion) {
    candidates.push(
      {
        x: centerX,
        y: obstaclesUnion.y - size.height / 2 - LABEL_GAP * 2,
      },
      {
        x: centerX,
        y:
          obstaclesUnion.y +
          obstaclesUnion.height +
          size.height / 2 +
          LABEL_GAP * 2,
      },
      {
        x: obstaclesUnion.x - size.width / 2 - LABEL_GAP * 2,
        y: centerY,
      },
      {
        x:
          obstaclesUnion.x +
          obstaclesUnion.width +
          size.width / 2 +
          LABEL_GAP * 2,
        y: centerY,
      },
    );
  }

  let nearest:
    | { box: Box; distance: number }
    | null = null;

  for (const candidate of candidates) {
    const box = {
      x: candidate.x - size.width / 2,
      y: candidate.y - size.height / 2,
      ...size,
    };

    if (!labelPlacementClear(box, input.obstacles, input.arrowSegments)) {
      continue;
    }

    const distance =
      Math.abs(candidate.x - centerX) + Math.abs(candidate.y - centerY);

    if (!nearest || distance < nearest.distance) {
      nearest = { box, distance };
    }
  }

  if (nearest && nearest.distance <= 120) {
    return nearest.box;
  }

  for (const offset of LABEL_OFFSETS) {
    const box = {
      x: centerX + offset.dx - size.width / 2,
      y: centerY + offset.dy - size.height / 2,
      ...size,
    };

    if (
      labelPlacementClear(box, input.obstacles, input.arrowSegments) &&
      (!nearest || offset.distance < nearest.distance)
    ) {
      return box;
    }
  }

  if (nearest) {
    return nearest.box;
  }

  const obstacleUnion = boundingBox(input.obstacles);
  const fallbackX = obstacleUnion
    ? obstacleUnion.x + obstacleUnion.width + size.width / 2 + LABEL_GAP * 2
    : centerX;
  const fallbackY = obstacleUnion
    ? obstacleUnion.y + size.height / 2
    : centerY;

  return {
    x: fallbackX - size.width / 2,
    y: fallbackY - size.height / 2,
    ...size,
  };
}

function labelPlacementClear(
  box: Box,
  obstacles: Box[],
  arrowSegments: Segment[],
): boolean {
  if (obstacles.some((obstacle) => overlapsBox(box, obstacle))) {
    return false;
  }

  return !arrowSegments.some((segment) =>
    segmentIntersectsBox(segment.a, segment.b, box, 2),
  );
}

function boundingBox(rects: Box[]): Box | null {
  if (rects.length === 0) {
    return null;
  }

  const minX = Math.min(...rects.map((rect) => rect.x));
  const minY = Math.min(...rects.map((rect) => rect.y));
  const maxX = Math.max(...rects.map((rect) => rect.x + rect.width));
  const maxY = Math.max(...rects.map((rect) => rect.y + rect.height));

  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

function overlapsBox(a: Box, b: Box): boolean {
  const margin = 6;

  return (
    a.x < b.x + b.width + margin &&
    a.x + a.width + margin > b.x &&
    a.y < b.y + b.height + margin &&
    a.y + a.height + margin > b.y
  );
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
