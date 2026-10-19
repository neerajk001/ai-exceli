import {
  aiResponseSchema,
  type AIRequest,
  type AIResponse,
} from "@wb/shared-types";

const DEFAULT_API_URL = "http://localhost:3001";

export const API_URL = import.meta.env.VITE_API_URL ?? DEFAULT_API_URL;

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

export type RequestOptions = {
  signal?: AbortSignal;
};

export function askAI(
  request: AIRequest,
  options: RequestOptions = {},
): Promise<AIResponse> {
  return postAI({ ...request, mode: "ask" }, options);
}

export function toCode(
  request: AIRequest,
  options: RequestOptions = {},
): Promise<AIResponse> {
  return postAI({ ...request, mode: "toCode" }, options);
}

export function cleanup(
  request: AIRequest,
  options: RequestOptions = {},
): Promise<AIResponse> {
  return postAI({ ...request, mode: "cleanup" }, options);
}

export function collaborate(
  request: AIRequest,
  options: RequestOptions = {},
): Promise<AIResponse> {
  return postAI({ ...request, mode: "collaborate" }, options);
}

async function postAI(
  request: AIRequest,
  options: RequestOptions,
): Promise<AIResponse> {
  let response: Response;

  try {
    response = await fetch(`${API_URL}/ai`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
      signal: options.signal,
    });
  } catch (error) {
    if (isAbortError(error)) {
      throw error;
    }

    throw new ApiError(
      0,
      "network_error",
      "Could not reach the AI service. Is the API running?",
    );
  }

  if (!response.ok) {
    throw await toApiError(response);
  }

  const parsed = aiResponseSchema.safeParse(await readJson(response));

  if (!parsed.success) {
    throw new ApiError(
      response.status,
      "invalid_response",
      "The AI service returned an unexpected response.",
    );
  }

  return parsed.data;
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

async function toApiError(response: Response): Promise<ApiError> {
  const body = (await readJson(response)) as {
    error?: { code?: unknown; message?: unknown };
  } | null;

  const code =
    typeof body?.error?.code === "string" ? body.error.code : "request_failed";
  const message =
    typeof body?.error?.message === "string"
      ? body.error.message
      : `Request failed with status ${response.status}.`;

  return new ApiError(response.status, code, message);
}
