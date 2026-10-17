import {
  aiResponseSchema,
  type AIRequest,
  type AIResponse,
  type Graph,
} from "@wb/shared-types";
import type { ZodError } from "zod";

import type { LLMClient, LLMGenerateParams } from "./llm";
import { buildAskPrompt } from "./modes/ask";

export async function askAI(
  llm: LLMClient,
  request: AIRequest,
): Promise<AIResponse> {
  switch (request.mode) {
    case "ask":
      return runAsk(llm, request);
    case "toCode":
    case "cleanup":
    case "collaborate":
      throw new Error(`AI mode "${request.mode}" is not implemented yet`);
  }
}

async function runAsk(llm: LLMClient, request: AIRequest): Promise<AIResponse> {
  const question = request.input?.trim();

  if (!question) {
    throw new Error(
      'Ask mode requires "input" (the question about the canvas)',
    );
  }

  const prompt = buildAskPrompt(request.graph, question);
  const params: LLMGenerateParams = {
    system: prompt.system,
    user: prompt.user,
    jsonSchema: prompt.jsonSchema,
  };

  let result = parseAskResponse(await llm.generate(params), request.graph);

  if (!result.ok) {
    const retryParams: LLMGenerateParams = {
      ...params,
      user: [
        prompt.user,
        "",
        "Your previous reply did not match the required JSON schema.",
        `Validation errors: ${result.message}`,
        "Return only corrected JSON.",
      ].join("\n"),
    };

    result = parseAskResponse(await llm.generate(retryParams), request.graph);

    if (!result.ok) {
      throw new Error(
        `LLM response was invalid after retry: ${result.message}`,
      );
    }
  }

  return result.value;
}

type AskParseResult =
  { ok: true; value: AIResponse } | { ok: false; message: string };

function parseAskResponse(raw: unknown, graph: Graph): AskParseResult {
  const parsed = aiResponseSchema.safeParse(raw);

  if (!parsed.success) {
    return { ok: false, message: formatIssues(parsed.error) };
  }

  if (typeof parsed.data.answer !== "string") {
    return { ok: false, message: '"answer" must be a string' };
  }

  if (!Array.isArray(parsed.data.highlightIds)) {
    return {
      ok: false,
      message: '"highlightIds" must be an array of node ids',
    };
  }

  const nodeIds = new Set(graph.nodes.map((node) => node.id));

  return {
    ok: true,
    value: {
      ...parsed.data,
      highlightIds: parsed.data.highlightIds.filter((id) => nodeIds.has(id)),
    },
  };
}

function formatIssues(error: ZodError): string {
  return error.issues
    .map((issue) => `${issue.path.join(".") || "<root>"}: ${issue.message}`)
    .join("; ");
}
