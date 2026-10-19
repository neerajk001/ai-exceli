import type { ErrorRequestHandler } from "express";

export class HttpError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.code = code;
  }
}

/**
 * Every error leaves the API in the same shape:
 * `{ "error": { "code": "...", "message": "..." } }`.
 * Provider errors and stack traces are logged server-side only.
 */
export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof HttpError) {
    res
      .status(error.status)
      .json({ error: { code: error.code, message: error.message } });
    return;
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "type" in error &&
    (error as { type?: unknown }).type === "entity.too.large"
  ) {
    res.status(413).json({
      error: {
        code: "payload_too_large",
        message: "Request body is too large.",
      },
    });
    return;
  }

  if (error instanceof SyntaxError && "body" in error) {
    res.status(400).json({
      error: {
        code: "invalid_json",
        message: "Request body is not valid JSON.",
      },
    });
    return;
  }

  console.error("[api] unhandled error:", error);

  res.status(500).json({
    error: {
      code: "internal_error",
      message: "Something went wrong. Please try again.",
    },
  });
};
