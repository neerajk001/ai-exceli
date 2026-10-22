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
import {
  buildGeneratePrompt,
  buildSchemaPrompt,
  generateLimits,
  inferGenerateDepth,
  isSchemaRequest,
  normalizeSchemaOps,
  type GenerateDepth,
} from "./modes/generate";
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
    case "generate":
      return runGenerate(llm, request);
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
    { system: prompt.system, user: prompt.user, jsonSchema: prompt.jsonSchema, strict: prompt.strict },
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
    { system: prompt.system, user: prompt.user, jsonSchema: prompt.jsonSchema, strict: prompt.strict },
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
    { system: prompt.system, user: prompt.user, jsonSchema: prompt.jsonSchema, strict: prompt.strict },
    (raw) => parseCollaborateResponse(raw, request.graph),
  );
}

async function runGenerate(
  llm: LLMClient,
  request: AIRequest,
): Promise<AIResponse> {
  const description = request.input?.trim();

  if (!description) {
    throw new Error(
      'Generate mode requires "input" (the diagram description)',
    );
  }

  const schemaMode = isSchemaRequest(description);
  const depth = inferGenerateDepth(description);
  const prompt = schemaMode
    ? buildSchemaPrompt(request.graph, description)
    : buildGeneratePrompt(request.graph, description, depth);

  return generateValidated(
    llm,
    {
      system: prompt.system,
      user: prompt.user,
      jsonSchema: prompt.jsonSchema,
      strict: prompt.strict,
    },
    (raw) =>
      parseGenerateResponse(
        raw,
        request.graph,
        description,
        depth,
        schemaMode,
      ),
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
    strict: prompt.strict,
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

function parseGenerateResponse(
  raw: unknown,
  graph: Graph,
  instruction: string,
  depth: GenerateDepth,
  schemaMode: boolean,
): ParseResult {
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

  const limits = schemaMode
    ? generateLimits("technical")
    : generateLimits(depth);
  const sanitized = sanitizeGenerateOps(
    parsed.data.ops,
    graph,
    limits.maxOps,
    schemaMode,
  );

  if (schemaMode) {
    const normalized = normalizeSchemaOps(sanitized, graph);

    if (!normalized.ok) {
      return { ok: false, message: normalized.message };
    }

    if (normalized.ops.length === 0) {
      return {
        ok: false,
        message: "No usable schema tables or relationships were returned.",
      };
    }

    return {
      ok: true,
      value: { ops: normalized.ops, answer: parsed.data.answer },
    };
  }

  const ops = depth === "technical" ? pruneOrphans(sanitized) : sanitized;

  if (ops.length === 0) {
    return { ok: false, message: "No usable add_node/add_edge ops were returned" };
  }

  const problem = findAudienceProblems(ops, graph, instruction, depth);

  if (problem) {
    return { ok: false, message: problem };
  }

  return { ok: true, value: { ops, answer: parsed.data.answer } };
}

function findAudienceProblems(
  ops: Op[],
  graph: Graph,
  instruction: string,
  depth: GenerateDepth,
): string | null {
  const nodes = ops.filter((op) => op.type === "add_node");
  const edges = ops.filter((op) => op.type === "add_edge");
  const limits = generateLimits(depth);
  const labelOf = (op: Extract<Op, { type: "add_node" }>) =>
    (op.node.text ?? op.node.id).split("\n")[0]?.trim() ?? op.node.id;

  if (nodes.length > limits.maxNodes) {
    return `The diagram has ${nodes.length} nodes, but this request allows at most ${limits.maxNodes}. Remove optional detail.`;
  }

  if (depth === "technical" && nodes.length < 5) {
    return "The request asks for technical depth; include the key services, storage, integrations and failure paths.";
  }

  const selfLoop = edges.find(
    (op) => op.type === "add_edge" && op.edge.from === op.edge.to,
  );

  if (selfLoop && selfLoop.type === "add_edge") {
    return `A concept points to itself ("${selfLoop.edge.from}"). Remove that edge.`;
  }

  if (depth !== "technical") {
    const outOfScope = findOutOfScopeNodes(nodes, instruction);

    if (outOfScope.length > 0) {
      return `Remove advanced or unrelated components the user did not ask for: ${outOfScope.join(
        ", ",
      )}. Keep only the main flow.`;
    }
  }

  if (nodes.length > 1) {
    const connected = new Set<string>();

    for (const op of edges) {
      if (op.type === "add_edge") {
        connected.add(op.edge.from);
        connected.add(op.edge.to);
      }
    }

    const orphans = nodes.filter(
      (op) => op.type === "add_node" && !connected.has(op.node.id),
    );

    if (orphans.length > 0) {
      return `These concepts are not connected to the main flow: ${orphans
        .map((op) => (op.type === "add_node" ? labelOf(op) : ""))
        .join(", ")}. Connect them or remove them.`;
    }

    const groups = countGroups(edges);

    if (groups > 1) {
      return `The diagram has ${groups} disconnected groups. Keep a single main flow.`;
    }
  }

  const seen = new Map<string, string>();

  for (const op of nodes) {
    if (op.type !== "add_node") {
      continue;
    }

    const key = (op.node.text ?? "").trim().replace(/\s+/g, " ").toLowerCase();
    const previous = seen.get(key);

    if (key.length > 0 && previous !== undefined) {
      return `"${labelOf(op)}" appears more than once (${previous}). Use each concept only once.`;
    }

    seen.set(key, labelOf(op));
  }

  const knownIds = new Set([
    ...graph.nodes.map((node) => node.id),
    ...nodes
      .filter((op) => op.type === "add_node")
      .map((op) => (op.type === "add_node" ? op.node.id : "")),
  ]);

  for (const op of edges) {
    if (
      op.type === "add_edge" &&
      (!knownIds.has(op.edge.from) || !knownIds.has(op.edge.to))
    ) {
      return `An edge references an unknown node ("${op.edge.from}" -> "${op.edge.to}").`;
    }
  }

  return null;
}

const ADVANCED_SCOPE_TERMS = [
  "mfa",
  "2fa",
  "multi-factor",
  "two-factor",
  "sso",
  "oauth",
  "openid",
  "saml",
  "passkey",
  "biometric",
  "webauthn",
  "magic link",
  "risk engine",
  "risk score",
  "rate limit",
  "audit",
  "websocket",
  "notification",
  "push notification",
  "sms",
  "encryption key",
  "token rotation",
  "database",
  "datastore",
  "identity store",
  "session store",
  "recipient",
  "recipient device",
  "message queue",
  "email delivery",
];

const LOGIN_METHOD_TERMS = new Set([
  "mfa",
  "2fa",
  "multi-factor",
  "two-factor",
  "sso",
  "oauth",
  "openid",
  "saml",
  "passkey",
  "biometric",
  "webauthn",
  "magic link",
]);

function findOutOfScopeNodes(
  nodes: Extract<Op, { type: "add_node" }>[],
  instruction: string,
): string[] {
  const asked = normalizeText(instruction);
  const asksForLoginMethods =
    /\b(login|sign[- ]?in|authentication|auth) methods?\b/i.test(instruction);
  const flagged: string[] = [];

  for (const op of nodes) {
    const label = normalizeText(op.node.text ?? "");

    if (
      ADVANCED_SCOPE_TERMS.some(
        (term) =>
          label.includes(term) &&
          !asked.includes(term) &&
          !(asksForLoginMethods && LOGIN_METHOD_TERMS.has(term)),
      )
    ) {
      flagged.push(`"${(op.node.text ?? op.node.id).replace(/\n/g, " ")}"`);
    }
  }

  return flagged;
}

function normalizeText(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function countGroups(edges: Op[]): number {
  const adjacency = new Map<string, Set<string>>();

  for (const op of edges) {
    if (op.type !== "add_edge" || op.edge.from === op.edge.to) {
      continue;
    }

    const from = adjacency.get(op.edge.from) ?? new Set<string>();
    from.add(op.edge.to);
    adjacency.set(op.edge.from, from);

    const to = adjacency.get(op.edge.to) ?? new Set<string>();
    to.add(op.edge.from);
    adjacency.set(op.edge.to, to);
  }

  const visited = new Set<string>();
  let groups = 0;

  for (const start of adjacency.keys()) {
    if (visited.has(start)) {
      continue;
    }

    groups += 1;
    const queue = [start];
    visited.add(start);

    while (queue.length > 0) {
      const current = queue.shift() ?? "";

      for (const next of adjacency.get(current) ?? []) {
        if (!visited.has(next)) {
          visited.add(next);
          queue.push(next);
        }
      }
    }
  }

  return groups;
}

function sanitizeGenerateOps(
  ops: Op[],
  graph: Graph,
  maxOps: number,
  schemaMode = false,
): Op[] {
  const nodeIds = new Set(graph.nodes.map((node) => node.id));
  const newIds = new Set<string>();

  for (const op of ops) {
    if (
      op.type === "add_node" &&
      SHAPE_KINDS.has(op.node.kind) &&
      !nodeIds.has(op.node.id) &&
      !newIds.has(op.node.id)
    ) {
      newIds.add(op.node.id);
    }
  }

  const known = (id: string) => nodeIds.has(id) || newIds.has(id);
  const allIds = new Set([...nodeIds, ...newIds]);
  const seen = new Set<string>();
  const usedEdgeIds = new Set<string>();
  const kept: Op[] = [];

  for (const op of ops) {
    if (kept.length >= maxOps) {
      break;
    }

    if (op.type === "add_node") {
      if (!newIds.has(op.node.id) || seen.has(op.node.id)) {
        continue;
      }

      seen.add(op.node.id);
      kept.push({
        type: "add_node",
        node: {
          id: op.node.id,
          kind: schemaMode ? "rectangle" : op.node.kind,
          ...(op.node.text === undefined ? {} : { text: op.node.text }),
          ...(op.node.fields === undefined ? {} : { fields: op.node.fields }),
        },
      });
    } else if (op.type === "add_edge") {
      if (known(op.edge.from) && known(op.edge.to)) {
        kept.push({
          type: "add_edge",
          edge: {
            ...op.edge,
            id: uniqueEdgeId(op.edge.id, allIds, usedEdgeIds),
          },
        });
      }
    }
  }

  return kept;
}

function uniqueEdgeId(
  id: string,
  nodeIds: ReadonlySet<string>,
  used: Set<string>,
): string {
  let candidate = nodeIds.has(id) ? `edge_${id}` : id;
  let suffix = 1;

  while (used.has(candidate)) {
    candidate = `edge_${id}_${suffix}`;
    suffix += 1;
  }

  used.add(candidate);

  return candidate;
}

/**
 * Technical diagrams occasionally include a decorative leaf node with no
 * connections. Drop those instead of failing the whole generation.
 */
function pruneOrphans(ops: Op[]): Op[] {
  const connected = new Set<string>();

  for (const op of ops) {
    if (op.type === "add_edge") {
      connected.add(op.edge.from);
      connected.add(op.edge.to);
    }
  }

  if (connected.size === 0) {
    return ops;
  }

  return ops.filter(
    (op) => op.type !== "add_node" || connected.has(op.node.id),
  );
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
