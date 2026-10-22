import type { AuthVerifier } from "../middleware/requireAuth";

const DEV_USER = { id: "dev-user", email: "dev@local" };

export function withDevAuth(
  verifier: AuthVerifier,
  token: string | undefined,
): AuthVerifier {
  if (!token) {
    return verifier;
  }

  return async (candidate) =>
    candidate === token ? DEV_USER : verifier(candidate);
}
