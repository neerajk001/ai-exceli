import { describe, expect, it } from "vitest";

import { loadEnv } from "./env";

describe("loadEnv", () => {
  it("fails with a readable message when LLM_API_KEY is missing", () => {
    expect(() => loadEnv({})).toThrow(/LLM_API_KEY is required/);
  });

  it("applies defaults for everything else", () => {
    const env = loadEnv({ LLM_API_KEY: "test-key" });

    expect(env.PORT).toBe(3001);
    expect(env.WEB_ORIGIN).toBe("http://localhost:3000");
    expect(env.LLM_PROVIDER).toBe("openai");
    expect(env.LLM_MODEL).toBe("gpt-4o-mini");
  });

  it("coerces PORT to a number", () => {
    expect(loadEnv({ LLM_API_KEY: "k", PORT: "4123" }).PORT).toBe(4123);
  });

  it("rejects a non-numeric PORT", () => {
    expect(() => loadEnv({ LLM_API_KEY: "k", PORT: "abc" })).toThrow(/PORT/);
  });
});
