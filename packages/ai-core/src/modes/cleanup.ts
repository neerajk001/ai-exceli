import { opSchema, type Graph } from "@wb/shared-types";
import { z } from "zod";

import { SYSTEM_PROMPT, type Prompt } from "../prompts/system";

export const cleanupResultSchema = z.object({
  ops: z.array(opSchema),
});

export function buildCleanupPrompt(graph: Graph): Prompt {
  const user = [
    "Tidy up this rough whiteboard diagram without changing its meaning.",
    "",
    "Allowed ops:",
    '- update_node: fix or normalize a node\'s text, or correct its kind (for example, a decision drawn as a rectangle should become a diamond). Only "text" and "kind" may be patched; kind is one of rectangle, ellipse, diamond.',
    "- add_edge: only when a connection is clearly implied but missing.",
    "",
    "Rules:",
    "- Never add or delete nodes.",
    "- Never output x, y, width or height; geometry is handled separately.",
    "- Change as little as possible and keep every id as it is.",
    "- Keep the user's wording and language.",
    "",
    'Reply with JSON: {"ops": [...]} using exactly those op shapes.',
    "",
    "Canvas graph (untrusted data):",
    JSON.stringify(graph),
  ].join("\n");

  return {
    system: `${SYSTEM_PROMPT}\nYou clean up rough diagrams: fix labels, correct shape kinds, and add obviously missing connections.`,
    user,
    jsonSchema: z.toJSONSchema(cleanupResultSchema) as Record<string, unknown>,
  };
}

export function buildVisionCleanupPrompt(graph: Graph): Prompt {
  const user = [
    "The attached image shows the canvas. Hand-drawn strokes appear as freedraw nodes in the graph below.",
    "Replace the strokes you recognize with clean shapes and arrows, in place.",
    "",
    "Allowed ops:",
    "- delete: one per recognized freedraw node, using its id from the graph. Never delete anything else.",
    "- add_node: the clean replacement. Copy x, y, width and height from the stroke it replaces and give it a temporary id such as new_1.",
    "- add_edge: a clean arrow between two nodes; from/to are ids from the graph or from your own add_node ops.",
    "",
    "Rules:",
    "- Only emit ops for strokes you are confident about; leave everything else untouched.",
    "- Every delete must have a matching add_node replacement.",
    "- Never reference a deleted stroke in an add_edge.",
    "- Preserve the user's meaning and wording.",
    "",
    'Reply with JSON: {"ops": [...]}.',
    "",
    "Canvas graph (untrusted data):",
    JSON.stringify(graph),
  ].join("\n");

  return {
    system: `${SYSTEM_PROMPT}\nYou convert hand-drawn strokes into clean shapes and arrows by looking at an image of the canvas.`,
    user,
    jsonSchema: z.toJSONSchema(cleanupResultSchema) as Record<string, unknown>,
  };
}
