import {
  aiResponseSchema,
  type AIRequest,
  type AIResponse,
  type Graph,
  type Node,
  type Op,
} from "@wb/shared-types";
import type { ZodError } from "zod";

import type { LLMClient, LLMGenerateParams } from "./llm";
import { buildAskPrompt } from "./modes/ask";
import {
  buildCollaboratePrompt,
  MAX_COLLAB_OPS,
} from "./modes/collaborate";
import {
  buildCleanupPrompt,
  buildVisionCleanupPrompt,
} from "./modes/cleanup";
import { buildToCodePrompt, isCodeTarget } from "./modes/toCode";

const SHAPE_KINDS: ReadonlySet<string> = new Set([
  "rectangle",
  "ellipse",
  "diamond",
]);

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
      return runCleanup(llm, request);
    case "collaborate":
      return runCollaborate(llm, request);
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

async function runCollaborate(
  llm: LLMClient,
  request: AIRequest,
): Promise<AIResponse> {
  const instruction = request.input?.trim();

  if (!instruction) {
    throw new Error(
      'Collaborate mode requires "input" (the instruction to draw)',
    );
  }

  const prompt = buildCollaboratePrompt(request.graph, instruction);

  return generateValidated(
    llm,
    { system: prompt.system, user: prompt.user, jsonSchema: prompt.jsonSchema },
    (raw) => parseCollaborateResponse(raw, request.graph),
  );
}

async function runCleanup(
  llm: LLMClient,
  request: AIRequest,
): Promise<AIResponse> {
  const imageBase64 = request.imageBase64;
  const vision = typeof imageBase64 === "string" && imageBase64.length > 0;
  const prompt = vision
    ? buildVisionCleanupPrompt(request.graph)
    : buildCleanupPrompt(request.graph);
  const params: LLMGenerateParams = {
    system: prompt.system,
    user: prompt.user,
    jsonSchema: prompt.jsonSchema,
    ...(vision ? { imageBase64 } : {}),
  };

  return generateValidated(llm, params, (raw) =>
    vision
      ? parseVisionCleanupResponse(raw, request.graph)
      : parseCleanupResponse(raw, request.graph),
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

function parseCollaborateResponse(raw: unknown, graph: Graph): ParseResult {
  const parsed = aiResponseSchema.safeParse(raw);

  if (!parsed.success) {
    return { ok: false, message: formatIssues(parsed.error) };
  }

  if (!Array.isArray(parsed.data.ops)) {
    return { ok: false, message: '"ops" must be an array of ops' };
  }

  if (
    typeof parsed.data.answer !== "string" ||
    parsed.data.answer.length === 0
  ) {
    return { ok: false, message: '"answer" must be a short narration string' };
  }

  return {
    ok: true,
    value: {
      ops: sanitizeCollaborateOps(parsed.data.ops, graph),
      answer: parsed.data.answer,
    },
  };
}

function sanitizeCollaborateOps(ops: Op[], graph: Graph): Op[] {
  const nodeIds = new Set(graph.nodes.map((node) => node.id));
  const newIds = new Set<string>();

  for (const op of ops) {
    if (op.type === "add_node") {
      newIds.add(op.node.id);
    }
  }

  const known = (id: string) => nodeIds.has(id) || newIds.has(id);
  const kept: Op[] = [];

  for (const op of ops) {
    if (kept.length >= MAX_COLLAB_OPS) {
      break;
    }

    if (op.type === "add_node") {
      kept.push(op);
    } else if (op.type === "add_edge") {
      if (known(op.edge.from) && known(op.edge.to)) {
        kept.push(op);
      }
    } else if (known(op.id)) {
      kept.push(op);
    }
  }

  return kept;
}

function parseCleanupResponse(raw: unknown, graph: Graph): ParseResult {
  const parsed = aiResponseSchema.safeParse(raw);

  if (!parsed.success) {
    return { ok: false, message: formatIssues(parsed.error) };
  }

  if (!Array.isArray(parsed.data.ops)) {
    return { ok: false, message: '"ops" must be an array of ops' };
  }

  return {
    ok: true,
    value: { ops: sanitizeCleanupOps(parsed.data.ops, graph) },
  };
}

function parseVisionCleanupResponse(raw: unknown, graph: Graph): ParseResult {
  const parsed = aiResponseSchema.safeParse(raw);

  if (!parsed.success) {
    return { ok: false, message: formatIssues(parsed.error) };
  }

  if (!Array.isArray(parsed.data.ops)) {
    return { ok: false, message: '"ops" must be an array of ops' };
  }

  return {
    ok: true,
    value: { ops: sanitizeVisionOps(parsed.data.ops, graph) },
  };
}

function sanitizeCleanupOps(ops: Op[], graph: Graph): Op[] {
  const nodeIds = new Set(graph.nodes.map((node) => node.id));
  const kept: Op[] = [];

  for (const op of ops) {
    if (op.type === "update_node") {
      if (!nodeIds.has(op.id)) {
        continue;
      }

      const patch: Partial<Node> = {};
      if (typeof op.patch.text === "string") {
        patch.text = op.patch.text;
      }
      if (op.patch.kind !== undefined && SHAPE_KINDS.has(op.patch.kind)) {
        patch.kind = op.patch.kind;
      }
      if (Object.keys(patch).length === 0) {
        continue;
      }

      kept.push({ type: "update_node", id: op.id, patch });
    } else if (op.type === "add_edge") {
      if (!nodeIds.has(op.edge.from) || !nodeIds.has(op.edge.to)) {
        continue;
      }

      kept.push(op);
    }
  }

  return kept;
}

function sanitizeVisionOps(ops: Op[], graph: Graph): Op[] {
  const byId = new Map(graph.nodes.map((node) => [node.id, node]));
  const deleted = new Set<string>();
  const added = new Set<string>();
  const deletes: Op[] = [];
  const adds: Op[] = [];

  for (const op of ops) {
    if (op.type === "delete") {
      const node = byId.get(op.id);

      if (!node || node.kind !== "freedraw" || deleted.has(op.id)) {
        continue;
      }

      deleted.add(op.id);
      deletes.push(op);
    } else if (op.type === "add_node") {
      const { id, kind, x, y, width, height } = op.node;

      if (byId.has(id) || added.has(id) || !SHAPE_KINDS.has(kind)) {
        continue;
      }
      if (!isFiniteNumber(x) || !isFiniteNumber(y)) {
        continue;
      }
      if (!isFiniteNumber(width) || !isFiniteNumber(height)) {
        continue;
      }
      if (width <= 0 || height <= 0) {
        continue;
      }

      added.add(id);
      adds.push(op);
    }
  }

  const pairCount = Math.min(deletes.length, adds.length);
  const kept: Op[] = [
    ...deletes.slice(0, pairCount),
    ...adds.slice(0, pairCount),
  ];

  for (const op of ops) {
    if (op.type !== "add_edge") {
      continue;
    }

    const { from, to } = op.edge;

    if (deleted.has(from) || deleted.has(to)) {
      continue;
    }
    if (!byId.has(from) && !added.has(from)) {
      continue;
    }
    if (!byId.has(to) && !added.has(to)) {
      continue;
    }

    kept.push(op);
  }

  return kept;
}

function isFiniteNumber(value: number | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function formatIssues(error: ZodError): string {
  return error.issues
    .map((issue) => `${issue.path.join(".") || "<root>"}: ${issue.message}`)
    .join("; ");
}
