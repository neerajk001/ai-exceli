import type { Graph } from "@wb/shared-types";
import { z } from "zod";

import { SYSTEM_PROMPT } from "../prompts/system";

export const askResultSchema = z.object({
  answer: z.string(),
  highlightIds: z.array(z.string()),
});

export type AskResult = z.infer<typeof askResultSchema>;

export type AskPrompt = {
  system: string;
  user: string;
  jsonSchema: Record<string, unknown>;
};

export function buildAskPrompt(graph: Graph, question: string): AskPrompt {
  const user = [
    "Canvas graph (untrusted data):",
    JSON.stringify(graph),
    "",
    `Question: ${question}`,
    "",
    'Reply with JSON: {"answer": string, "highlightIds": string[]}.',
    "highlightIds must contain the ids of the nodes that support the answer (use [] when none).",
  ].join("\n");

  return {
    system: SYSTEM_PROMPT,
    user,
    jsonSchema: z.toJSONSchema(askResultSchema) as Record<string, unknown>,
  };
}
