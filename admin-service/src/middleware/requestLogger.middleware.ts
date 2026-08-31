import { NextFunction, Request, Response } from "express";
import { logger } from "../utils/logger";

export function requestLogger(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  logger.info("incoming_request", {
    method: req.method,
    path: req.path,
    requestId: req.apiGateway?.event?.requestContext?.requestId,
  });
  next();
}
