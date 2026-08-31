import { NextFunction, Request, Response } from "express";
import { HttpStatus } from "../enum/httpStatus.enum";
import { AppError } from "../utils/response";
import { env } from "../config/env";

/**
 * Extracts the authenticated admin's identity from the Cognito JWT claims
 * that API Gateway's native JWT authorizer attaches to the request before
 * this Lambda is ever invoked.
 *
 * This is defence-in-depth, not the primary access control: an
 * unauthenticated request never reaches this Lambda in the first place,
 * because API Gateway rejects it at the authorizer. If claims are missing
 * here in a deployed environment, something is misconfigured (e.g. this
 * route isn't actually behind the authorizer), so we fail closed rather
 * than silently proceeding as an anonymous admin.
 */
export function requireAdmin(req: Request, _res: Response, next: NextFunction) {
  if (env.isLocal) {
    req.admin = { sub: "local-dev", email: "local-dev@zk-sudo.local" };
    return next();
  }

  const claims = req.apiGateway?.event?.requestContext?.authorizer?.jwt?.claims;

  if (!claims || typeof claims.sub !== "string") {
    throw new AppError(
      HttpStatus.UNAUTHORIZED,
      "Missing or invalid admin identity. This route must sit behind the Cognito JWT authorizer in API Gateway.",
    );
  }

  req.admin = {
    sub: claims.sub,
    email: typeof claims.email === "string" ? claims.email : undefined,
  };

  next();
}
