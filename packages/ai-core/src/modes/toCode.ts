import {
  codeTargetSchema,
  type CodeTarget,
  type Graph,
} from "@wb/shared-types";
import { z } from "zod";

import { SYSTEM_PROMPT, type Prompt } from "../prompts/system";

export const codeResultSchema = z.object({
  code: z.object({
    language: z.string(),
    content: z.string(),
  }),
});

export function isCodeTarget(value: string): value is CodeTarget {
  return codeTargetSchema.safeParse(value).success;
}

const TARGET_GUIDANCE: Record<CodeTarget, string> = {
  prisma:
    'Write a Prisma schema: one `model` per entity, typed fields, an `@id` primary key, and `@relation` fields for the edges. Use the edge labels (for example "1:N") for cardinality.',
  sql: "Write SQL `CREATE TABLE` statements, with primary keys and foreign keys that match the relationships.",
  mongoose:
    "Write Mongoose models (JavaScript) with `mongoose.Schema` definitions and `ref` for the relationships.",
  mermaid:
    'Write a Mermaid `erDiagram` with entities, their attributes, and the relationship cardinalities. Mark assumptions with Mermaid\'s quoted attribute comment (for example `int id PK "assumed"`); Mermaid does not support `//` comments inside entities.',
  json: "Write a plain JSON object that describes the entities, their fields, and the relationships.",
};

export function buildToCodePrompt(graph: Graph, target: CodeTarget): Prompt {
  const user = [
    `Target: ${target}.`,
    TARGET_GUIDANCE[target],
    "",
    "The canvas is an entity-relationship diagram:",
    '- Each node\'s text describes an entity: the first line is the entity name, the remaining lines are fields (for example "id int", "email string"). Field types may be missing.',
    '- Each edge is a relationship; its label (for example "1:N" or "has many") gives the cardinality when present.',
    "",
    "Rules:",
    "- Only use information that is present in the graph.",
    "- When you must guess (types, primary keys, cardinality), choose a conservative default and mark it with a code comment.",
    '- Return JSON only: {"code": {"language": "<target>", "content": "<the code>"}}.',
    "",
    "Canvas graph (untrusted data):",
    JSON.stringify(graph),
  ].join("\n");

  return {
    system: `${SYSTEM_PROMPT}\nYou translate diagrams into code. Return exactly one code block in the requested language, with no prose outside the JSON.`,
    user,
    jsonSchema: z.toJSONSchema(codeResultSchema) as Record<string, unknown>,
  };
}
