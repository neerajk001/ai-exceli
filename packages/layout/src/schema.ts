import type { Cardinality, SchemaField } from "@wb/shared-types";

export const SCHEMA_HEADER_HEIGHT = 36;
export const SCHEMA_ROW_HEIGHT = 22;
export const SCHEMA_FIELD_TOP = 8;
export const SCHEMA_BOTTOM_PADDING = 10;
export const SCHEMA_PADDING_X = 14;
export const SCHEMA_FIELD_FONT_SIZE = 13;
export const SCHEMA_HEADER_FONT_SIZE = 17;
export const SCHEMA_FIELD_CHAR_WIDTH = 7.8;
export const SCHEMA_HEADER_CHAR_WIDTH = 9.5;
export const SCHEMA_MIN_WIDTH = 240;

export type SchemaTableMetrics = {
  width: number;
  height: number;
  headerHeight: number;
  rowHeight: number;
  fieldTop: number;
  fieldLines: string[];
  fieldRowCenters: number[];
};

export function formatCardinality(cardinality?: Cardinality): string {
  switch (cardinality) {
    case "one-to-one":
      return "1:1";
    case "many-to-many":
      return "N:M";
    default:
      return "1:N";
  }
}

export function schemaFieldLines(fields: readonly SchemaField[]): string[] {
  const nameWidth = Math.max(...fields.map((field) => field.name.length), 1);
  const typeWidth = Math.max(...fields.map((field) => field.type.length), 1);
  const keys = fields.map(fieldKeyLabel);
  const keyWidth = Math.max(...keys.map((key) => key.length), 2);

  return fields.map((field, index) => {
    const key = (keys[index] ?? "").padEnd(keyWidth);
    const flags = fieldFlags(field);
    const line = `${field.name.padEnd(nameWidth)}  ${field.type.padEnd(typeWidth)}  ${key}`;

    return flags.length > 0 ? `${line}  ${flags}`.trimEnd() : line.trimEnd();
  });
}

export function estimateSchemaTable(
  tableName: string,
  fields: readonly SchemaField[],
): SchemaTableMetrics {
  const fieldLines = schemaFieldLines(fields);
  const headerWidth = tableName.length * SCHEMA_HEADER_CHAR_WIDTH;
  const fieldWidth = Math.max(
    0,
    ...fieldLines.map((line) => line.length * SCHEMA_FIELD_CHAR_WIDTH),
  );
  const width = Math.ceil(
    Math.max(SCHEMA_MIN_WIDTH, headerWidth + SCHEMA_PADDING_X * 2, fieldWidth + SCHEMA_PADDING_X * 2),
  );
  const height =
    SCHEMA_HEADER_HEIGHT +
    SCHEMA_FIELD_TOP +
    Math.max(1, fields.length) * SCHEMA_ROW_HEIGHT +
    SCHEMA_BOTTOM_PADDING;

  return {
    width,
    height,
    headerHeight: SCHEMA_HEADER_HEIGHT,
    rowHeight: SCHEMA_ROW_HEIGHT,
    fieldTop: SCHEMA_FIELD_TOP,
    fieldLines,
    fieldRowCenters: fields.map(
      (_, index) =>
        SCHEMA_HEADER_HEIGHT +
        SCHEMA_FIELD_TOP +
        index * SCHEMA_ROW_HEIGHT +
        SCHEMA_ROW_HEIGHT / 2,
    ),
  };
}

export function schemaRowCenterY(tableY: number, index: number): number {
  return (
    tableY +
    SCHEMA_HEADER_HEIGHT +
    SCHEMA_FIELD_TOP +
    index * SCHEMA_ROW_HEIGHT +
    SCHEMA_ROW_HEIGHT / 2
  );
}

function fieldKeyLabel(field: SchemaField): string {
  const keys: string[] = [];

  if (field.primaryKey) {
    keys.push("PK");
  }

  if (field.foreignKey) {
    keys.push("FK");
  }

  return keys.join(" ");
}

function fieldFlags(field: SchemaField): string {
  const flags: string[] = [];

  if (field.foreignKey) {
    flags.push(`-> ${field.foreignKey.table}.${field.foreignKey.field}`);
  }

  if (field.unique) {
    flags.push("UQ");
  }

  if (field.nullable === true) {
    flags.push("NULL");
  } else if (field.nullable === false) {
    flags.push("NOT NULL");
  }

  if (field.default) {
    flags.push(`DEFAULT ${field.default}`);
  }

  return flags.join(" · ");
}
