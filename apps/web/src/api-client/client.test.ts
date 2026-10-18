import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiError, askAI, toCode } from "./client";

const request = {
  mode: "ask" as const,
  graph: { nodes: [], edges: [] },
  input: "q",
};

function mockFetch(
  impl: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>,
) {
  vi.stubGlobal("fetch", vi.fn(impl));
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("askAI (api client)", () => {
  it("parses a valid AIResponse", async () => {
    mockFetch(
      async () =>
        new Response(JSON.stringify({ answer: "hi", highlightIds: ["a"] }), {
          status: 200,
        }),
    );

    await expect(askAI(request)).resolves.toEqual({
      answer: "hi",
      highlightIds: ["a"],
    });
  });

  it("maps API errors to a readable ApiError", async () => {
    mockFetch(
      async () =>
        new Response(
          JSON.stringify({
            error: { code: "graph_too_large", message: "Graph is too big." },
          }),
          { status: 413 },
        ),
    );

    const error = await askAI(request).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 413,
      code: "graph_too_large",
      message: "Graph is too big.",
    });
  });

  it("reports a readable error when the API is unreachable", async () => {
    mockFetch(async () => {
      throw new TypeError("Failed to fetch");
    });

    const error = await askAI(request).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).code).toBe("network_error");
    expect((error as ApiError).message).toMatch(/Could not reach/);
  });

  it("rejects a response that does not match the AIResponse schema", async () => {
    mockFetch(
      async () =>
        new Response(JSON.stringify({ answer: 123 }), { status: 200 }),
    );

    const error = await askAI(request).catch((caught: unknown) => caught);

    expect((error as ApiError).code).toBe("invalid_response");
  });

  it("sends toCode requests with the toCode mode", async () => {
    let sentBody: unknown;
    mockFetch(async (_input, init) => {
      sentBody = JSON.parse(String(init?.body ?? "{}"));
      return new Response(
        JSON.stringify({ code: { language: "sql", content: "SELECT 1;" } }),
        { status: 200 },
      );
    });

    const response = await toCode({
      mode: "toCode",
      graph: { nodes: [], edges: [] },
      input: "sql",
    });

    expect(sentBody).toMatchObject({ mode: "toCode", input: "sql" });
    expect(response.code?.language).toBe("sql");
  });

  it("lets abort errors propagate untouched", async () => {
    mockFetch(async () => {
      throw new DOMException("Aborted", "AbortError");
    });

    const error = await askAI(request).catch((caught: unknown) => caught);

    expect((error as Error).name).toBe("AbortError");
  });
});
