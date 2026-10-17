import { askAI, type LLMClient } from "@wb/ai-core";
import { aiRequestSchema, aiResponseSchema } from "@wb/shared-types";
import { Router } from "express";
import type { ZodError } from "zod";

import { HttpError } from "../middleware/errorHandler";

export const MAX_GRAPH_NODES = 300;

export function createAiRouter(llm: LLMClient): Router {
  const router = Router();

  router.post("/", async (req, res, next) => {
    try {
      const parsedRequest = aiRequestSchema.safeParse(req.body);

      if (!parsedRequest.success) {
        throw new HttpError(
          400,
          "invalid_request",
          `Invalid AI request: ${formatIssues(parsedRequest.error)}`,
        );
      }

      const request = parsedRequest.data;

      if (request.graph.nodes.length > MAX_GRAPH_NODES) {
        throw new HttpError(
          413,
          "graph_too_large",
          `Graph has ${request.graph.nodes.length} nodes; the limit is ${MAX_GRAPH_NODES}.`,
        );
      }

      const response = aiResponseSchema.safeParse(await askAI(llm, request));

      if (!response.success) {
        throw new HttpError(
          500,
          "invalid_ai_response",
          "The AI returned a response that failed validation.",
        );
      }

      res.json(response.data);
    } catch (error) {
      next(error);
    }
  });

  return router;
}

function formatIssues(error: ZodError): string {
  return error.issues
    .map((issue) => `${issue.path.join(".") || "<root>"}: ${issue.message}`)
    .join("; ");
}
