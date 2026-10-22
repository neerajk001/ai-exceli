import { z } from "zod";

export const nodeKindSchema = z.enum([
  "rectangle",
  "ellipse",
  "diamond",
  "text",
  "freedraw",
  "other",
]);

export const cardinalitySchema = z.enum([
  "one-to-one",
  "one-to-many",
  "many-to-many",
]);

export const schemaFieldSchema = z.object({
  name: z.string().min(1),
  type: z.string().min(1),
  primaryKey: z.boolean().optional(),
  foreignKey: z
    .object({
      table: z.string().min(1),
      field: z.string().min(1),
    })
    .optional(),
  unique: z.boolean().optional(),
  nullable: z.boolean().optional(),
  default: z.string().optional(),
});

export const schemaRelationshipSchema = z.object({
  fromField: z.string().min(1).optional(),
  toField: z.string().min(1).optional(),
  cardinality: cardinalitySchema.optional(),
});

export const nodeSchema = z.object({
  id: z.string(),
  kind: nodeKindSchema,
  text: z.string().optional(),
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
  fields: z.array(schemaFieldSchema).optional(),
});

export const newNodeSchema = z.object({
  id: z.string(),
  kind: nodeKindSchema,
  text: z.string().optional(),
  x: z.number().optional(),
  y: z.number().optional(),
  width: z.number().optional(),
  height: z.number().optional(),
  fields: z.array(schemaFieldSchema).optional(),
});

export const edgeSchema = z.object({
  id: z.string(),
  from: z.string(),
  to: z.string(),
  label: z.string().optional(),
  fromField: z.string().optional(),
  toField: z.string().optional(),
  cardinality: cardinalitySchema.optional(),
});

export const newEdgeSchema = z.object({
  id: z.string(),
  from: z.string(),
  to: z.string(),
  label: z.string().optional(),
  fromField: z.string().optional(),
  toField: z.string().optional(),
  cardinality: cardinalitySchema.optional(),
});

export const graphSchema = z.object({
  nodes: z.array(nodeSchema),
  edges: z.array(edgeSchema),
});

export const opSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("add_node"), node: newNodeSchema }),
  z.object({ type: z.literal("add_edge"), edge: newEdgeSchema }),
  z.object({
    type: z.literal("update_node"),
    id: z.string(),
    patch: nodeSchema.partial(),
  }),
  z.object({ type: z.literal("delete"), id: z.string() }),
]);

export const aiModeSchema = z.enum([
  "ask",
  "toCode",
  "cleanup",
  "collaborate",
  "generate",
]);

export const CODE_TARGETS = [
  "prisma",
  "sql",
  "mongoose",
  "mermaid",
  "json",
] as const;

export const codeTargetSchema = z.enum(CODE_TARGETS);

export const aiRequestSchema = z.object({
  mode: aiModeSchema,
  graph: graphSchema,
  input: z.string().optional(),
  imageBase64: z.string().optional(),
});

export const codeSchema = z.object({
  language: z.string(),
  content: z.string(),
});

export const aiResponseSchema = z.object({
  ops: z.array(opSchema).optional(),
  highlightIds: z.array(z.string()).optional(),
  answer: z.string().optional(),
  code: codeSchema.optional(),
});

export type NodeKind = z.infer<typeof nodeKindSchema>;
export type SchemaField = z.infer<typeof schemaFieldSchema>;
export type Cardinality = z.infer<typeof cardinalitySchema>;
export type SchemaRelationship = z.infer<typeof schemaRelationshipSchema>;
export type Node = z.infer<typeof nodeSchema>;
export type NewNode = z.infer<typeof newNodeSchema>;
export type Edge = z.infer<typeof edgeSchema>;
export type NewEdge = z.infer<typeof newEdgeSchema>;
export type Graph = z.infer<typeof graphSchema>;
export type Op = z.infer<typeof opSchema>;
export type AIMode = z.infer<typeof aiModeSchema>;
export type CodeTarget = z.infer<typeof codeTargetSchema>;
export type AIRequest = z.infer<typeof aiRequestSchema>;
export type AIResponse = z.infer<typeof aiResponseSchema>;
export type Code = z.infer<typeof codeSchema>;
