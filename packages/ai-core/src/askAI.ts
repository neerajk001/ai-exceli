import {
  aiResponseSchema,
  type AIRequest,
  type AIResponse,
  type Graph,
} from "@wb/shared-types";
import type { ZodError } from "zod";

import type { LLMClient, LLMGenerateParams } from "./llm";
import { buildAskPrompt } from "./modes/ask";
import { buildToCodePrompt, isCodeTarget } from "./modes/toCode";

export async function askAI(
  llm: LLMClient,
  request: AIRequest,
): Promise<AIResponse> {
  switch (request.mode) {
    case "ask":
      return runAsk(llm, request);
    case "toCode":
      return runToCode(llm, request);
    case "cleanup":
    case "collaborate":
      throw new Error(`AI mode "${request.mode}" is not implemented yet`);
  }
}

type ParseResult =
  { ok: true; value: AIResponse } | { ok: false; message: string };

/**
 * Runs the LLM once, and if the reply does not validate, retries once with the
 * validation error appended to the prompt. Throws when the retry also fails.
 */
async function generateValidated(
  llm: LLMClient,
  params: LLMGenerateParams,
  parse: (raw: unknown) => ParseResult,
): Promise<AIResponse> {
  let result = parse(await llm.generate(params));

  if (!result.ok) {
    const retryParams: LLMGenerateParams = {
      ...params,
      user: [
        params.user,
        "",
        "Your previous reply did not match the required JSON schema.",
        `Validation errors: ${result.message}`,
        "Return only corrected JSON.",
      ].join("\n"),
    };

    result = parse(await llm.generate(retryParams));

    if (!result.ok) {
      throw new Error(
        `LLM response was invalid after retry: ${result.message}`,
      );
    }
  }

  return result.value;
}

async function runAsk(llm: LLMClient, request: AIRequest): Promise<AIResponse> {
  const question = request.input?.trim();

  if (!question) {
    throw new Error(
      'Ask mode requires "input" (the question about the canvas)',
    );
  }

  const prompt = buildAskPrompt(request.graph, question);

  return generateValidated(
    llm,
    { system: prompt.system, user: prompt.user, jsonSchema: prompt.jsonSchema },
    (raw) => parseAskResponse(raw, request.graph),
  );
}

async function runToCode(
  llm: LLMClient,
  request: AIRequest,
): Promise<AIResponse> {
  const target = request.input?.trim().toLowerCase() ?? "";

  if (!isCodeTarget(target)) {
    throw new Error(
      'To-code mode requires "input" to be one of: prisma, sql, mongoose, mermaid, json',
    );
  }

  const prompt = buildToCodePrompt(request.graph, target);

  return generateValidated(
    llm,
    { system: prompt.system, user: prompt.user, jsonSchema: prompt.jsonSchema },
    parseCodeResponse,
  );
}

function parseAskResponse(raw: unknown, graph: Graph): ParseResult {
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

function parseCodeResponse(raw: unknown): ParseResult {
  const parsed = aiResponseSchema.safeParse(raw);

  if (!parsed.success) {
    return { ok: false, message: formatIssues(parsed.error) };
  }

  const code = parsed.data.code;

  if (
    !code ||
    typeof code.language !== "string" ||
    typeof code.content !== "string"
  ) {
    return {
      ok: false,
      message:
        'To-code responses must include "code" with "language" and "content"',
    };
  }

  return { ok: true, value: { code } };
}

function formatIssues(error: ZodError): string {
  return error.issues
    .map((issue) => `${issue.path.join(".") || "<root>"}: ${issue.message}`)
    .join("; ");
}
