import {
  opSchema,
  type Cardinality,
  type Graph,
  type Op,
  type SchemaField,
} from "@wb/shared-types";
import { z } from "zod";

import { SYSTEM_PROMPT, type Prompt } from "../prompts/system";

export type GenerateDepth = "beginner" | "general" | "technical";

export const MAX_GENERATE_OPS = 30;
export const MAX_GENERATE_OPS_TECHNICAL = 45;
export const MAX_GENERATE_NODES = 12;
export const MAX_GENERATE_NODES_BEGINNER = 8;
export const MAX_GENERATE_NODES_TECHNICAL = 24;

const TECHNICAL_PATTERN =
  /\b(under the hood|internals?|architecture|implementation|production[- ]ready|technical deep dive|technical|backend|system design|distributed|scalab\w*|webhooks?|idempoten\w*|event[- ]driven|protocols?|database schema|throughput|latency|reconciliation)\b/i;

const BEGINNER_PATTERN =
  /\b(simple|simply|beginner|basics|eli5|no technical background|non-technical|plain english|for a child|like i'?m (five|5))\b/i;

/** Technical depth overrides simplicity; beginner hints win otherwise. */
export function inferGenerateDepth(instruction: string): GenerateDepth {
  if (TECHNICAL_PATTERN.test(instruction)) {
    return "technical";
  }

  if (BEGINNER_PATTERN.test(instruction)) {
    return "beginner";
  }

  return "general";
}

export function generateLimits(depth: GenerateDepth): {
  maxOps: number;
  maxNodes: number;
} {
  switch (depth) {
    case "beginner":
      return { maxOps: MAX_GENERATE_OPS, maxNodes: MAX_GENERATE_NODES_BEGINNER };
    case "technical":
      return {
        maxOps: MAX_GENERATE_OPS_TECHNICAL,
        maxNodes: MAX_GENERATE_NODES_TECHNICAL,
      };
    case "general":
      return { maxOps: MAX_GENERATE_OPS, maxNodes: MAX_GENERATE_NODES };
  }
}

export const generateResultSchema = z.object({
  ops: z.array(opSchema),
  answer: z.string(),
});

export function buildGeneratePrompt(
  graph: Graph,
  instruction: string,
  depth: GenerateDepth = inferGenerateDepth(instruction),
): Prompt {
  const limits = generateLimits(depth);
  const system = [
    "You are an excellent visual teacher. You explain ideas through honest diagrams.",
    "",
    "AUDIENCE AND DEPTH",
    "- Read the request and choose the depth before drawing:",
    "  - beginner: explain simply with 4-7 nodes, everyday words, no infrastructure detail.",
    "  - general: show the main components and how they interact (about 5-9 nodes).",
    "  - technical (for example 'under the hood', 'architecture', 'implementation', 'production-ready', 'internals'): show the real backend services, data stores, external integrations, protocols or events, security boundaries and failure paths.",
    "- The user's explicit depth wins over the default simplicity preference.",
    "- Default to an ordinary person with no technical background only for beginner and general requests.",
    "",
    "DEPTH RULES",
    "- Beginner: prefer 4-7 nodes; use fewer when the idea is simple.",
    "- General: keep the main flow and only the components needed to understand it.",
    `- Technical: include the components required for correctness, never invent details, and stay within ${limits.maxNodes} nodes and ${limits.maxOps} operations.`,
    "- For technical diagrams: distinguish synchronous calls from asynchronous events and webhooks; show database reads and writes; include important security boundaries, idempotency/duplicate protection, retries, timeouts, reconciliation and failure paths where relevant; use concise technical labels; group components into logical layers.",
    "- For payment diagrams: use provider-hosted fields or tokenization; never store raw card numbers or CVVs; model signed webhooks as asynchronous provider events with verification and deduplication; show pending/success/failed states where relevant.",
    "",
    "SIMPLICITY AND SCOPE",
    "- Answer exactly what was asked, nothing more.",
    "- For beginner and general requests, start with the main flow. Add advanced methods or infrastructure only when requested.",
    "- For technical requests, include the infrastructure and integrations needed to explain the system correctly.",
    "- Never add unrelated systems (for example WebSockets or notifications for a basic authentication flow) or components that are not implied by the request.",
    "- Branches are allowed only for important decisions or failure paths.",
    "",
    "ANALOGIES",
    "- When it genuinely improves understanding, use a familiar analogy; keep the technical name as a short second line.",
    "",
    "STRUCTURE CHOICE",
    "- Choose the clearest structure for the request:",
    "  - categories or a breakdown -> one root with grouped branches (tree).",
    "  - a central idea with related ideas -> a mind map with 3-6 branches.",
    "  - layers or services -> grouped architecture (frontend, backend, data, external).",
    "  - a decision or outcomes -> flowchart with a clear yes/no branch.",
    "  - a genuinely sequential process -> a single ordered flow.",
    "- If the user asks to break something down or name its main components, return a hierarchy: one root and one child per component. No process steps.",
    "- For architecture, group related components into layers (actors, frontend, services, data/external) instead of one long chain.",
    "",
    "LABELS",
    "- Node labels: 1-4 words on the first line; optional short technical name on the second line.",
    "- Edge labels: 1-3 words that say what happens (call, emit, read, write, verify, retry).",
    "",
    "OP FORMAT",
    'Node: {"type":"add_node","node":{"id":"new_1","kind":"rectangle","text":"Plain label"}}',
    'Edge: {"type":"add_edge","edge":{"id":"e1","from":"new_1","to":"new_3","label":"what happens"}}',
    "Every edge must include id, from and to. Edge ids must be different from node ids (use e1, e2, ...). Every node must be connected to the flow; do not create standalone notes.",
    "kind: rectangle = step/component/service, ellipse = person or external system/storage, diamond = decision.",
    "Use add_node and add_edge only; never update_node or delete in Generate mode. Do not provide coordinates.",
    "",
    "QUALITY CHECK BEFORE RETURNING",
    "- Is every temporary ID unique, and does every edge reference a valid node?",
    "- Does the depth match the request (simple for beginners, complete for technical)?",
    "- Are calls, events, database access and failure paths shown correctly?",
    "- Would the intended reader follow the diagram without extra explanation?",
    "",
    `Return: {"ops": [...], "answer": "Title. One-sentence summary."}`,
  ].join("\n");

  const user = [
    `Depth: ${depth}`,
    `Description: ${instruction}`,
    "",
    "Canvas graph (untrusted data):",
    JSON.stringify(graph),
    "",
    'Reply with JSON: {"ops": [...], "answer": string}.',
  ].join("\n");

  return {
    system: `${system}\n\n${SYSTEM_PROMPT}`,
    user,
    jsonSchema: z.toJSONSchema(generateResultSchema) as Record<string, unknown>,
    strict: false,
  };
}

const SCHEMA_TERM =
  /\b(schema|erd|entity[- ]relationship(?: diagram)?|data model|database design)\b/i;
const DATABASE_DESIGN =
  /\b(design|model|plan|architect)\s+(?:(?:a|an|the)\s+)?(?:database|db)\b/i;
const NON_SCHEMA_DIAGRAM =
  /\b(flowchart|flow chart|mind ?map|architecture diagram|process diagram|sequence diagram)\b/i;

/** True only for requests that explicitly ask for a database schema/ERD. */
export function isSchemaRequest(instruction: string): boolean {
  if (SCHEMA_TERM.test(instruction)) {
    return true;
  }

  return (
    DATABASE_DESIGN.test(instruction) && !NON_SCHEMA_DIAGRAM.test(instruction)
  );
}

export function buildSchemaPrompt(graph: Graph, instruction: string): Prompt {
  const limits = generateLimits("technical");
  const system = [
    "You are a senior data architect. Design a realistic relational database schema and render it as an ERD.",
    "",
    "OUTPUT FORMAT",
    "- Return only add_node and add_edge operations. Do not include coordinates.",
    "- Each table is one add_node with kind \"rectangle\", text set to the table name, and a fields array.",
    "- Each field has: name, type, and optional primaryKey, foreignKey {table, field}, unique, nullable, and default.",
    "- Use lowercase snake_case table names and field names. Use generic SQL types such as uuid, text, varchar(255), integer, bigint, boolean, timestamptz, numeric(12,2), and jsonb.",
    "",
    "SCHEMA RULES",
    "- Every table needs a primary key. Composite primary keys are allowed for junction tables.",
    "- Every relationship must be backed by a foreign-key field. Put the reference in that field's foreignKey metadata.",
    `- Keep the whole schema within ${limits.maxNodes} tables and ${limits.maxOps} total operations.`,
    "- Include realistic, domain-specific fields. Never return a summary field such as \"username, profile, posts\".",
    "- Use a junction table for many-to-many relationships. Give the junction table a composite primary key made of its foreign keys.",
    "- Use one-to-many relationships for normal parent/child links and one-to-one relationships only when the child foreign key is unique.",
    "- Self-references are allowed, for example users.manager_id -> users.id.",
    "- Add useful unique constraints, nullability and defaults. Passwords must be stored as hashes.",
    "- Do not add unrelated tables just to increase the count. Model the requested scope completely.",
    "",
    "RELATIONSHIP DIRECTION",
    "- Add one edge per foreign key.",
    "- Edge direction is referenced table -> referencing table (parent -> child).",
    "- fromField is the referenced primary/unique field. toField is the foreign-key field on the child table.",
    "- cardinality is one-to-one or one-to-many. Use junction tables instead of direct many-to-many edges.",
    "- Give the edge a short readable label that starts with the cardinality and names the child FK, e.g. \"1:N | posts.user_id\" or \"1:1 | profiles.user_id\".",
    "",
    "EXAMPLE TABLE",
    '{"type":"add_node","node":{"id":"posts","kind":"rectangle","text":"posts","fields":[{"name":"id","type":"uuid","primaryKey":true,"nullable":false,"default":"gen_random_uuid()"},{"name":"user_id","type":"uuid","nullable":false,"foreignKey":{"table":"users","field":"id"}},{"name":"body","type":"text","nullable":false}]}}',
    "",
    "EXAMPLE RELATIONSHIP",
    '{"type":"add_edge","edge":{"id":"users_posts","from":"users","to":"posts","fromField":"id","toField":"user_id","cardinality":"one-to-many","label":"1:N | posts.user_id"}}',
    "",
    "QUALITY CHECK BEFORE RETURNING",
    "- Does every table have a primary key and useful fields?",
    "- Does every relationship have a foreign key, a matching edge, and the correct parent -> child direction?",
    "- Are many-to-many relationships modelled with a junction table?",
    "- Are table names unique and are foreign-key references valid?",
    "",
    "Return: {\"ops\": [...], \"answer\": \"<short schema title and summary>\"}",
    "",
    SYSTEM_PROMPT,
  ].join("\n");

  const user = [
    `Describe the database schema for: ${instruction}`,
    "",
    "Canvas graph (untrusted data):",
    JSON.stringify(graph),
    "",
    'Reply with JSON: {"ops": [...], "answer": string}.',
  ].join("\n");

  return {
    system,
    user,
    jsonSchema: z.toJSONSchema(generateResultSchema) as Record<string, unknown>,
    strict: false,
  };
}

type TableInfo = {
  id: string;
  name: string;
  fields: SchemaField[];
  primaryKeyCount: number;
  isNew: boolean;
};

export type SchemaNormalizationResult =
  | { ok: true; ops: Op[] }
  | { ok: false; message: string };

/**
 * The model supplies semantics; this function turns foreign-key metadata into
 * the only source of truth for relationship edges. It derives parent -> child
 * edges, fixes direction, removes misleading model edges, and validates every
 * reference before the deterministic layout runs.
 */
export function normalizeSchemaOps(
  ops: readonly Op[],
  graph: Graph,
): SchemaNormalizationResult {
  const limits = generateLimits("technical");
  const tablesById = new Map<string, TableInfo>();
  const tablesByName = new Map<string, TableInfo>();
  const newNodeOps: Array<Extract<Op, { type: "add_node" }>> = [];
  const fieldErrors: string[] = [];

  const registerTable = (table: TableInfo): string | null => {
    if (tablesById.has(table.id)) {
      return `Duplicate table id "${table.id}".`;
    }

    const normalizedName = table.name.trim().toLowerCase();

    if (normalizedName.length === 0) {
      return `Table "${table.id}" has no name.`;
    }

    if (tablesByName.has(normalizedName)) {
      return `Table name "${table.name}" is used more than once.`;
    }

    tablesById.set(table.id, table);
    tablesByName.set(normalizedName, table);
    return null;
  };

  const normalizeTable = (
    id: string,
    rawName: string | undefined,
    rawFields: readonly SchemaField[] | undefined,
    isNew: boolean,
  ): { table?: TableInfo; error?: string } => {
    const name = (rawName ?? "").trim();

    if (name.length === 0) {
      return { error: `Table "${id}" needs a table name.` };
    }

    if (!rawFields || rawFields.length === 0) {
      return {
        error: `Table "${name}" must include its fields; summary labels are not valid schema fields.`,
      };
    }

    const fields: SchemaField[] = [];
    const seenFields = new Set<string>();

    for (const rawField of rawFields) {
      const fieldName = rawField.name.trim();
      const type = rawField.type.trim();

      if (fieldName.length === 0 || type.length === 0) {
        return { error: `Table "${name}" has a field without a name or type.` };
      }

      const normalized = fieldName.toLowerCase();

      if (seenFields.has(normalized)) {
        return {
          error: `Table "${name}" has duplicate field "${fieldName}".`,
        };
      }

      seenFields.add(normalized);
      fields.push({
        ...rawField,
        name: fieldName,
        type,
        ...(rawField.foreignKey
          ? {
              foreignKey: {
                table: rawField.foreignKey.table.trim(),
                field: rawField.foreignKey.field.trim(),
              },
            }
          : {}),
        ...(rawField.default === undefined
          ? {}
          : { default: rawField.default.trim() }),
      });
    }

    let primaryKeyCount = fields.filter((field) => field.primaryKey).length;

    if (primaryKeyCount === 0) {
      const idField = fields.find(
        (field) => field.name.toLowerCase() === "id",
      );

      if (!idField) {
        return {
          error: `Table "${name}" needs a primary key field marked with primaryKey: true.`,
        };
      }

      idField.primaryKey = true;
      primaryKeyCount = 1;
    }

    return {
      table: {
        id,
        name,
        fields,
        primaryKeyCount,
        isNew,
      },
    };
  };

  for (const node of graph.nodes) {
    if (!node.fields || node.fields.length === 0) {
      continue;
    }

    const result = normalizeTable(node.id, node.text ?? node.id, node.fields, false);

    if (result.error) {
      return { ok: false, message: result.error };
    }

    if (result.table) {
      const error = registerTable(result.table);

      if (error) {
        return { ok: false, message: error };
      }
    }
  }

  for (const op of ops) {
    if (op.type !== "add_node") {
      continue;
    }

    const result = normalizeTable(
      op.node.id,
      op.node.text,
      op.node.fields,
      true,
    );

    if (result.error) {
      return { ok: false, message: result.error };
    }

    if (!result.table) {
      continue;
    }

    const error = registerTable(result.table);

    if (error) {
      return { ok: false, message: error };
    }

    newNodeOps.push({
      type: "add_node",
      node: {
        id: result.table.id,
        kind: "rectangle",
        text: result.table.name,
        fields: result.table.fields,
      },
    });
  }

  if (newNodeOps.length === 0) {
    return {
      ok: false,
      message: "No tables with fields were returned for this schema request.",
    };
  }

  if (newNodeOps.length > limits.maxNodes) {
    return {
      ok: false,
      message: `The schema has ${newNodeOps.length} tables, but the limit is ${limits.maxNodes}.`,
    };
  }

  for (const table of tablesById.values()) {
    for (const field of table.fields) {
      if (!field.foreignKey) {
        continue;
      }

      const parent = tablesByName.get(
        field.foreignKey.table.trim().toLowerCase(),
      );
      const parentField = parent?.fields.find(
        (candidate) =>
          candidate.name.trim().toLowerCase() ===
          field.foreignKey?.field.trim().toLowerCase(),
      );

      if (!parent || !parentField) {
        fieldErrors.push(
          `"${table.name}.${field.name}" references unknown table/field "${field.foreignKey.table}.${field.foreignKey.field}".`,
        );
        continue;
      }

      if (!parentField.primaryKey && !parentField.unique) {
        fieldErrors.push(
          `"${table.name}.${field.name}" references "${parent.name}.${parentField.name}", which is not a primary or unique field.`,
        );
      }
    }
  }

  if (fieldErrors.length > 0) {
    return { ok: false, message: fieldErrors.slice(0, 5).join(" ") };
  }

  const modelEdges = ops
    .filter((op): op is Extract<Op, { type: "add_edge" }> => op.type === "add_edge")
    .map((op) => op.edge);
  const usedEdgeIds = new Set<string>(
    [...graph.nodes, ...newNodeOps.map((op) => op.node)].map((node) => node.id),
  );
  const relationshipOps: Array<Extract<Op, { type: "add_edge" }>> = [];
  const seenRelationships = new Set<string>();

  for (const table of tablesById.values()) {
    for (const field of table.fields) {
      if (!field.foreignKey) {
        continue;
      }

      const parent = tablesByName.get(
        field.foreignKey.table.trim().toLowerCase(),
      );
      const parentField = parent?.fields.find(
        (candidate) =>
          candidate.name.trim().toLowerCase() ===
          field.foreignKey?.field.trim().toLowerCase(),
      );

      if (!parent || !parentField) {
        continue;
      }

      const key = `${parent.id}:${parentField.name}->${table.id}:${field.name}`;

      if (seenRelationships.has(key)) {
        continue;
      }

      seenRelationships.add(key);

      const cardinality =
        field.unique === true ||
        (field.primaryKey === true && table.primaryKeyCount === 1)
          ? ("one-to-one" as const)
          : ("one-to-many" as const);
      const cardinalityLabel = cardinalityText(cardinality);
      const modelEdge = modelEdges.find(
        (edge) =>
          (edge.from === parent.id &&
            edge.to === table.id &&
            (!edge.toField ||
              edge.toField.trim().toLowerCase() === field.name.toLowerCase())) ||
          (edge.from === table.id &&
            edge.to === parent.id &&
            (!edge.fromField ||
              edge.fromField.trim().toLowerCase() === field.name.toLowerCase())),
      );
      const modelLabel = cleanSchemaLabel(modelEdge?.label);
      const label = modelLabel
        ? /\b(1:1|1:N|N:M)\b/.test(modelLabel)
          ? modelLabel
          : `${cardinalityLabel} | ${modelLabel}`
        : `${cardinalityLabel} | ${table.name}.${field.name}`;
      const edgeId = uniqueSchemaEdgeId(
        modelEdge?.id,
        `${table.id}_${field.name}`,
        usedEdgeIds,
      );

      relationshipOps.push({
        type: "add_edge",
        edge: {
          id: edgeId,
          from: parent.id,
          to: table.id,
          fromField: parentField.name,
          toField: field.name,
          cardinality,
          label,
        },
      });
    }
  }

  if (relationshipOps.length === 0 && newNodeOps.length > 1) {
    return {
      ok: false,
      message:
        "No foreign-key relationships were returned. Connect tables with foreign keys and add one relationship edge per foreign key.",
    };
  }

  if (newNodeOps.length + relationshipOps.length > limits.maxOps) {
    return {
      ok: false,
      message: `The schema needs ${newNodeOps.length + relationshipOps.length} operations, but the limit is ${limits.maxOps}.`,
    };
  }

  return {
    ok: true,
    ops: [...newNodeOps, ...relationshipOps],
  };
}

function cleanSchemaLabel(label: string | undefined): string | undefined {
  const cleaned = label
    ?.replace(/[\u00b7\ufffd]/g, "|")
    .replace(/\u2192/g, "->")
    .replace(/\s+/g, " ")
    .trim();

  return cleaned && cleaned.length > 0 ? cleaned : undefined;
}

function cardinalityText(cardinality: Cardinality): string {
  if (cardinality === "one-to-one") {
    return "1:1";
  }

  if (cardinality === "many-to-many") {
    return "N:M";
  }

  return "1:N";
}

function uniqueSchemaEdgeId(
  preferred: string | undefined,
  fallback: string,
  used: Set<string>,
): string {
  const base = (preferred ?? `schema_${fallback}`).replace(/\s+/g, "_");
  let candidate = used.has(base) ? `schema_${fallback}` : base;
  let suffix = 1;

  while (used.has(candidate)) {
    candidate = `schema_${fallback}_${suffix}`;
    suffix += 1;
  }

  used.add(candidate);
  return candidate;
}
