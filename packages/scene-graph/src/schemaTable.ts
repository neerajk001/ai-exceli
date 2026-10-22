import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import type {
  Cardinality,
  SchemaField,
  SchemaRelationship,
} from "@wb/shared-types";

const SCHEMA_DECORATION_FOR = "schemaDecorationFor";
const SCHEMA_FIELDS = "schemaFields";
const SCHEMA_TABLE_NAME = "schemaTableName";
const SCHEMA_RELATIONSHIP = "schemaRelationship";

export type SchemaTableData = {
  name: string;
  fields: SchemaField[];
};

function customDataOf(
  element: ExcalidrawElement,
): Record<string, unknown> | undefined {
  const data = element.customData as Record<string, unknown> | null | undefined;

  return data ?? undefined;
}

export function schemaTableData(
  element: ExcalidrawElement,
): SchemaTableData | undefined {
  const data = customDataOf(element);
  const fields = data?.[SCHEMA_FIELDS];
  const name = data?.[SCHEMA_TABLE_NAME];

  if (!Array.isArray(fields) || fields.length === 0) {
    return undefined;
  }

  return {
    name: typeof name === "string" && name.length > 0 ? name : "table",
    fields: fields as SchemaField[],
  };
}

export function schemaDecorationFor(
  element: ExcalidrawElement,
): string | undefined {
  const tableId = customDataOf(element)?.[SCHEMA_DECORATION_FOR];

  return typeof tableId === "string" && tableId.length > 0
    ? tableId
    : undefined;
}

export function isSchemaDecoration(element: ExcalidrawElement): boolean {
  return schemaDecorationFor(element) !== undefined;
}

export function schemaTableCustomData(
  name: string,
  fields: readonly SchemaField[],
): Record<string, unknown> {
  return {
    [SCHEMA_FIELDS]: fields,
    [SCHEMA_TABLE_NAME]: name,
  };
}

export function schemaDecorationCustomData(
  tableId: string,
): Record<string, unknown> {
  return { [SCHEMA_DECORATION_FOR]: tableId };
}

export function schemaRelationship(
  element: ExcalidrawElement,
): SchemaRelationship | undefined {
  const data = customDataOf(element)?.[SCHEMA_RELATIONSHIP];

  if (typeof data !== "object" || data === null) {
    return undefined;
  }

  const relationship = data as {
    fromField?: unknown;
    toField?: unknown;
    cardinality?: unknown;
  };
  const cardinality =
    relationship.cardinality === "one-to-one" ||
    relationship.cardinality === "one-to-many" ||
    relationship.cardinality === "many-to-many"
      ? (relationship.cardinality as Cardinality)
      : undefined;

  return {
    ...(typeof relationship.fromField === "string"
      ? { fromField: relationship.fromField }
      : {}),
    ...(typeof relationship.toField === "string"
      ? { toField: relationship.toField }
      : {}),
    ...(cardinality ? { cardinality } : {}),
  };
}

export function schemaRelationshipCustomData(
  relationship: SchemaRelationship,
): Record<string, unknown> {
  return { [SCHEMA_RELATIONSHIP]: relationship };
}
