import { askAI, type LLMClient } from "@wb/ai-core";
import { aiRequestSchema, aiResponseSchema } from "@wb/shared-types";
import { Router } from "express";

import { HttpError } from "../middleware/errorHandler";
import { formatIssues } from "../validation";

export const MAX_GRAPH_NODES = 300;
export const MAX_IMAGE_BASE64_CHARS = 3_000_000;

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

      if (request.imageBase64 !== undefined && request.mode !== "cleanup") {
        throw new HttpError(
          400,
          "invalid_request",
          "imageBase64 is only supported in cleanup mode.",
        );
      }

      if (
        request.imageBase64 !== undefined &&
        request.imageBase64.length > MAX_IMAGE_BASE64_CHARS
      ) {
        throw new HttpError(
          413,
          "image_too_large",
          `imageBase64 exceeds the ${MAX_IMAGE_BASE64_CHARS} character limit.`,
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
