import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import {
  estimateSchemaTable,
  layoutWithKind,
  schemaRowCenterY,
  schemaFieldLines,
} from "@wb/layout";
import type { NewEdge, NewNode, Op, SchemaField } from "@wb/shared-types";
import { describe, expect, it } from "vitest";

import { applyOps } from "../src/applyOps";
import { edgeLabelArrowId } from "../src/edgeLabels";
import { excalidrawToGraph } from "../src/excalidrawToGraph";
import {
  schemaDecorationFor,
  schemaTableData,
} from "../src/schemaTable";
import { validateDiagramLayout } from "../src/validateLayout";

function field(
  name: string,
  type: string,
  extra: Partial<SchemaField> = {},
): SchemaField {
  return { name, type, ...extra };
}

const nodes: NewNode[] = [
  {
    id: "users",
    kind: "rectangle",
    text: "users",
    fields: [
      field("id", "uuid", {
        primaryKey: true,
        nullable: false,
        default: "gen_random_uuid()",
      }),
      field("username", "varchar(40)", { unique: true, nullable: false }),
      field("email", "varchar(255)", { unique: true, nullable: false }),
      field("manager_id", "uuid", {
        foreignKey: { table: "users", field: "id" },
        nullable: true,
      }),
    ],
  },
  {
    id: "profiles",
    kind: "rectangle",
    text: "profiles",
    fields: [
      field("id", "uuid", { primaryKey: true }),
      field("user_id", "uuid", {
        unique: true,
        nullable: false,
        foreignKey: { table: "users", field: "id" },
      }),
      field("bio", "text", { nullable: true }),
    ],
  },
  {
    id: "posts",
    kind: "rectangle",
    text: "posts",
    fields: [
      field("id", "uuid", { primaryKey: true }),
      field("user_id", "uuid", {
        nullable: false,
        foreignKey: { table: "users", field: "id" },
      }),
      field("body", "text", { nullable: false }),
      field("created_at", "timestamptz", {
        nullable: false,
        default: "now()",
      }),
    ],
  },
  {
    id: "comments",
    kind: "rectangle",
    text: "comments",
    fields: [
      field("id", "uuid", { primaryKey: true }),
      field("post_id", "uuid", {
        nullable: false,
        foreignKey: { table: "posts", field: "id" },
      }),
      field("user_id", "uuid", {
        nullable: false,
        foreignKey: { table: "users", field: "id" },
      }),
      field("body", "text", { nullable: false }),
    ],
  },
  {
    id: "follows",
    kind: "rectangle",
    text: "follows",
    fields: [
      field("follower_id", "uuid", {
        primaryKey: true,
        foreignKey: { table: "users", field: "id" },
      }),
      field("following_id", "uuid", {
        primaryKey: true,
        foreignKey: { table: "users", field: "id" },
      }),
      field("created_at", "timestamptz", { default: "now()" }),
    ],
  },
  {
    id: "sessions",
    kind: "rectangle",
    text: "sessions",
    fields: [
      field("id", "uuid", { primaryKey: true }),
      field("user_id", "uuid", {
        nullable: false,
        foreignKey: { table: "users", field: "id" },
      }),
      field("token_hash", "text", { unique: true, nullable: false }),
      field("expires_at", "timestamptz", { nullable: false }),
    ],
  },
];

const edges: NewEdge[] = [
  {
    id: "users_profiles",
    from: "users",
    to: "profiles",
    fromField: "id",
    toField: "user_id",
    cardinality: "one-to-one",
    label: "1:1 · profiles.user_id",
  },
  {
    id: "users_posts",
    from: "users",
    to: "posts",
    fromField: "id",
    toField: "user_id",
    cardinality: "one-to-many",
    label: "1:N · posts.user_id",
  },
  {
    id: "users_comments",
    from: "users",
    to: "comments",
    fromField: "id",
    toField: "user_id",
    cardinality: "one-to-many",
    label: "1:N · comments.user_id",
  },
  {
    id: "posts_comments",
    from: "posts",
    to: "comments",
    fromField: "id",
    toField: "post_id",
    cardinality: "one-to-many",
    label: "1:N · comments.post_id",
  },
  {
    id: "users_followers",
    from: "users",
    to: "follows",
    fromField: "id",
    toField: "follower_id",
    cardinality: "one-to-many",
    label: "1:N · follows.follower_id",
  },
  {
    id: "users_following",
    from: "users",
    to: "follows",
    fromField: "id",
    toField: "following_id",
    cardinality: "one-to-many",
    label: "1:N · follows.following_id",
  },
  {
    id: "users_sessions",
    from: "users",
    to: "sessions",
    fromField: "id",
    toField: "user_id",
    cardinality: "one-to-many",
    label: "1:N · sessions.user_id",
  },
  {
    id: "users_manager",
    from: "users",
    to: "users",
    fromField: "id",
    toField: "manager_id",
    cardinality: "one-to-many",
    label: "1:N · users.manager_id",
  },
];

function schemaOps(): Op[] {
  return [
    ...nodes.map((node): Op => ({ type: "add_node", node })),
    ...edges.map((edge): Op => ({ type: "add_edge", edge })),
  ];
}

function applySchema() {
  return applyOps([] as ExcalidrawElement[], schemaOps(), {
    layout: layoutWithKind("schema"),
  });
}

function scenePoints(arrow: ExcalidrawElement) {
  if (arrow.type !== "arrow") {
    return [];
  }

  return arrow.points.map(([x, y]) => ({
    x: arrow.x + (x ?? 0),
    y: arrow.y + (y ?? 0),
  }));
}

describe("schema table rendering", () => {
  it("renders table headers and full field rows inside measured nodes", () => {
    const result = applySchema();
    const graph = excalidrawToGraph(result.elements);

    expect(result.skipped).toEqual([]);
    expect(result.layoutIssues).toEqual([]);
    expect(validateDiagramLayout(result.elements)).toEqual([]);

    for (const node of nodes) {
      const tableId = result.idMap.get(node.id);
      const table = result.elements.find((element) => element.id === tableId);

      expect(table).toBeDefined();
      expect(table && schemaTableData(table)?.fields.length).toBe(
        node.fields?.length,
      );

      const metrics = estimateSchemaTable(
        node.text ?? "table",
        node.fields ?? [],
      );
      expect((table?.width ?? 0) >= metrics.width).toBe(true);
      expect((table?.height ?? 0) >= metrics.height).toBe(true);

      const decorations = result.elements.filter(
        (element) => schemaDecorationFor(element) === tableId,
      );
      const decorationText = decorations.flatMap((element) =>
        element.type === "text" ? [element.text] : [],
      );

      expect(decorations.length).toBeGreaterThanOrEqual(2);
      expect(decorationText.some((text) => text === node.text)).toBe(true);

      const fieldText = decorationText.find((text) =>
        text.includes(node.fields?.[0]?.name ?? ""),
      );
      expect(fieldText).toContain("uuid");
      expect(fieldText).toContain("PK");
    }

    const graphNodes = graph.nodes.filter((node) => node.fields);
    expect(graphNodes).toHaveLength(nodes.length);
    expect(graph.nodes.filter((node) => node.kind === "text")).toHaveLength(0);
    expect(
      graph.edges.every(
        (edge) =>
          edge.fromField !== undefined &&
          edge.toField !== undefined &&
          edge.cardinality !== undefined,
      ),
    ).toBe(true);
  });

  it("anchors relationship arrows on the exact field rows", () => {
    const result = applySchema();

    for (const edge of edges.filter((candidate) => candidate.id !== "users_manager")) {
      const arrowId = result.idMap.get(edge.id);
      const arrow = result.elements.find((element) => element.id === arrowId);
      const fromTableId = result.idMap.get(edge.from);
      const toTableId = result.idMap.get(edge.to);
      const fromTable = result.elements.find(
        (element) => element.id === fromTableId,
      );
      const toTable = result.elements.find(
        (element) => element.id === toTableId,
      );
      const fromNode = nodes.find((node) => node.id === edge.from);
      const toNode = nodes.find((node) => node.id === edge.to);

      if (!arrow || !fromTable || !toTable || !fromNode || !toNode) {
        throw new Error(`missing geometry for ${edge.id}`);
      }

      const points = scenePoints(arrow);
      const fromIndex =
        fromNode.fields?.findIndex(
          (candidate) => candidate.name === edge.fromField,
        ) ?? -1;
      const toIndex =
        toNode.fields?.findIndex(
          (candidate) => candidate.name === edge.toField,
        ) ?? -1;
      const expectedStartY = schemaRowCenterY(fromTable.y, fromIndex);
      const expectedEndY = schemaRowCenterY(toTable.y, toIndex);

      expect(Math.abs((points[0]?.y ?? 0) - expectedStartY)).toBeLessThan(1);
      expect(
        Math.abs((points[points.length - 1]?.y ?? 0) - expectedEndY),
      ).toBeLessThan(1);
    }
  });

  it("supports self-references without crossing the table", () => {
    const result = applySchema();
    const selfArrowId = result.idMap.get("users_manager");
    const arrow = result.elements.find((element) => element.id === selfArrowId);
    const usersTableId = result.idMap.get("users");
    const usersTable = result.elements.find(
      (element) => element.id === usersTableId,
    );

    if (!arrow || arrow.type !== "arrow" || !usersTable) {
      throw new Error("missing self reference geometry");
    }

    expect(scenePoints(arrow).length).toBeGreaterThan(2);
    expect(arrow.endBinding?.elementId).toBe(usersTableId);

    for (const point of scenePoints(arrow).slice(1, -1)) {
      expect(point.x > usersTable.x + usersTable.width).toBe(true);
    }
  });

  it("removes table decorations and attached edges when a table is deleted", () => {
    const created = applySchema();
    const postsId = created.idMap.get("posts");

    if (!postsId) {
      throw new Error("missing posts table");
    }

    const deleted = applyOps(
      created.elements,
      [{ type: "delete", id: postsId }],
      { layout: layoutWithKind("schema") },
    );

    expect(
      deleted.elements.some((element) => element.id === postsId),
    ).toBe(false);
    expect(
      deleted.elements.some(
        (element) => schemaDecorationFor(element) === postsId,
      ),
    ).toBe(false);
    expect(
      deleted.elements.some(
        (element) =>
          element.type === "arrow" &&
          (element.startBinding?.elementId === postsId ||
            element.endBinding?.elementId === postsId),
      ),
    ).toBe(false);
    const removedArrowIds = new Set(
      created.elements
        .filter(
          (element) =>
            element.type === "arrow" &&
            (element.startBinding?.elementId === postsId ||
              element.endBinding?.elementId === postsId),
        )
        .map((element) => element.id),
    );

    expect(removedArrowIds.size).toBeGreaterThan(0);
    expect(
      deleted.elements.some(
        (element) =>
          element.type === "text" &&
          removedArrowIds.has(edgeLabelArrowId(element) ?? ""),
      ),
    ).toBe(false);
  });

  it("keeps a schema with long fields and a disconnected table valid", () => {
    const longNodes: NewNode[] = [
      {
        id: "organizations",
        kind: "rectangle",
        text: "organizations",
        fields: [
          field("organization_identifier", "uuid", {
            primaryKey: true,
          }),
          field(
            "organization_display_name",
            "varchar(255)",
            { nullable: false },
          ),
        ],
      },
      {
        id: "members",
        kind: "rectangle",
        text: "members",
        fields: [
          field("id", "uuid", { primaryKey: true }),
          field("organization_identifier", "uuid", {
            nullable: false,
            foreignKey: {
              table: "organizations",
              field: "organization_identifier",
            },
          }),
        ],
      },
      {
        id: "system_settings",
        kind: "rectangle",
        text: "system_settings",
        fields: [
          field("id", "uuid", { primaryKey: true }),
          field("setting_key", "varchar(120)", {
            unique: true,
            nullable: false,
          }),
          field("setting_value", "jsonb", { nullable: true }),
        ],
      },
    ];
    const longEdges: NewEdge[] = [
      {
        id: "org_members",
        from: "organizations",
        to: "members",
        fromField: "organization_identifier",
        toField: "organization_identifier",
        cardinality: "one-to-many",
        label: "1:N · members.organization_identifier",
      },
    ];
    const result = applyOps(
      [] as ExcalidrawElement[],
      [
        ...longNodes.map((node): Op => ({ type: "add_node", node })),
        ...longEdges.map((edge): Op => ({ type: "add_edge", edge })),
      ],
      { layout: layoutWithKind("schema") },
    );

    expect(result.layoutIssues).toEqual([]);

    const orgId = result.idMap.get("organizations");
    const org = result.elements.find((element) => element.id === orgId);
    const fieldText = result.elements.find(
      (element) =>
        element.type === "text" &&
        schemaDecorationFor(element) === orgId &&
        element.text.includes("organization_display_name"),
    );

    expect(org?.width).toBeGreaterThanOrEqual(
      estimateSchemaTable("organizations", longNodes[0]?.fields ?? []).width,
    );
    expect(fieldText).toBeDefined();

    if (fieldText?.type === "text") {
      const lines = schemaFieldLines(longNodes[0]?.fields ?? []);
      expect(lines.join("\n")).toContain("organization_display_name");
      expect(fieldText.text).toContain("organization_display_name");
    }
  });
});
