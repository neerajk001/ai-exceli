import { describe, expect, it } from "vitest";

import { loadEnv } from "./env";

const baseEnv = {
  LLM_API_KEY: "test-key",
  SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_ANON_KEY: "anon-key",
  DATABASE_URL: "postgresql://user:pass@localhost:5432/db",
};

describe("loadEnv", () => {
  it("fails with a readable message when LLM_API_KEY is missing", () => {
    expect(() => loadEnv({ ...baseEnv, LLM_API_KEY: undefined })).toThrow(
      /LLM_API_KEY is required/,
    );
  });

  it("fails when Supabase or database settings are missing", () => {
    expect(() =>
      loadEnv({ ...baseEnv, SUPABASE_URL: undefined }),
    ).toThrow(/SUPABASE_URL is required/);
    expect(() =>
      loadEnv({ ...baseEnv, DATABASE_URL: undefined }),
    ).toThrow(/DATABASE_URL is required/);
  });

  it("applies defaults for everything else", () => {
    const env = loadEnv(baseEnv);

    expect(env.PORT).toBe(3001);
    expect(env.WEB_ORIGIN).toBe("http://localhost:3000");
    expect(env.LLM_PROVIDER).toBe("openai");
    expect(env.LLM_MODEL).toBe("gpt-4o-mini");
    expect(env.SUPABASE_URL).toBe("https://example.supabase.co");
  });

  it("coerces PORT to a number", () => {
    expect(loadEnv({ ...baseEnv, PORT: "4123" }).PORT).toBe(4123);
  });

  it("rejects a non-numeric PORT", () => {
    expect(() => loadEnv({ ...baseEnv, PORT: "abc" })).toThrow(/PORT/);
  });
});
