import type { NextFunction, Request, RequestHandler, Response } from "express";

export type AuthUser = { id: string; email: string };
export type AuthVerifier = (token: string) => Promise<AuthUser | null>;

type RequireAuthOptions = {
  verifyToken: AuthVerifier;
  ensureUser: (user: AuthUser) => Promise<void>;
};

export function getUser(res: Response): AuthUser | undefined {
  return res.locals.user as AuthUser | undefined;
}

export function createRequireAuth(
  options: RequireAuthOptions,
): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction) => {
    const [scheme, token] = (req.headers.authorization ?? "").split(" ");

    if (scheme !== "Bearer" || !token) {
      res.status(401).json({
        error: {
          code: "unauthorized",
          message: "A valid bearer token is required.",
        },
      });
      return;
    }

    try {
      const user = await options.verifyToken(token);

      if (!user) {
        res.status(401).json({
          error: {
            code: "unauthorized",
            message: "The bearer token is invalid or expired.",
          },
        });
        return;
      }

      await options.ensureUser(user);
      res.locals.user = user;
      next();
    } catch (error) {
      next(error);
    }
  };
}
