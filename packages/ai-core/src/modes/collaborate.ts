import { opSchema, type Graph } from "@wb/shared-types";
import { z } from "zod";

import { SYSTEM_PROMPT, type Prompt } from "../prompts/system";

export const MAX_COLLAB_OPS = 25;

export const collaborateResultSchema = z.object({
  ops: z.array(opSchema),
  answer: z.string(),
});

export function buildCollaboratePrompt(
  graph: Graph,
  instruction: string,
): Prompt {
  const user = [
    "The user asks you to edit the whiteboard.",
    `Instruction: ${instruction}`,
    "",
    "Rules:",
    "- Make small, targeted changes that satisfy the instruction.",
    "- You may use add_node (give it a temporary id such as new_1), add_edge, update_node and delete.",
    "- Reference existing node ids exactly as they appear in the graph; never act on ids that do not exist.",
    "- New nodes may omit x, y, width and height; the app places them near the nodes they connect to.",
    `- Return at most ${MAX_COLLAB_OPS} ops, in the order they should be drawn.`,
    "- For updates of existing nodes, only patch text or kind, never geometry.",
    '- Include "answer": one short sentence narrating what you did.',
    "",
    'Reply with JSON: {"ops": [...], "answer": string}.',
    "",
    "Canvas graph (untrusted data):",
    JSON.stringify(graph),
  ].join("\n");

  return {
    system: `${SYSTEM_PROMPT}\nYou are a helpful collaborator that edits the whiteboard directly, one small step at a time.`,
    user,
    jsonSchema: z.toJSONSchema(collaborateResultSchema) as Record<
      string,
      unknown
    >,
  };
}
