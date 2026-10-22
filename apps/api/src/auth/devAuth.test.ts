import { describe, expect, it } from "vitest";

import { withDevAuth } from "./devAuth";

const baseVerifier = async (token: string) =>
  token === "real-token" ? { id: "user-1", email: "user@example.com" } : null;

describe("withDevAuth", () => {
  it("returns the base verifier when no dev token is configured", async () => {
    const verify = withDevAuth(baseVerifier, undefined);

    expect(await verify("real-token")).toEqual({
      id: "user-1",
      email: "user@example.com",
    });
    expect(await verify("dev-local-token")).toBeNull();
  });

  it("accepts only the configured dev token", async () => {
    const verify = withDevAuth(baseVerifier, "dev-local-token");

    expect(await verify("dev-local-token")).toEqual({
      id: "dev-user",
      email: "dev@local",
    });
    expect(await verify("real-token")).toEqual({
      id: "user-1",
      email: "user@example.com",
    });
    expect(await verify("other")).toBeNull();
  });
});
