import { NextFunction, Request, Response } from "express";
import { AppError, sendError } from "../utils/response";
import { HttpStatus } from "../enum/httpStatus.enum";
import { logger } from "../utils/logger";

// Express identifies error-handling middleware by arity (4 params) — keep
// all four even though `_next` is unused.
export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
) {
  if (err instanceof AppError) {
    logger.warn("handled_error", {
      path: req.path,
      message: err.message,
      statusCode: err.statusCode,
    });
    sendError(res, err.statusCode, err.message, err.details);
    return;
  }

  logger.error("unhandled_error", {
    path: req.path,
    message: err instanceof Error ? err.message : "Unknown error",
    stack: err instanceof Error ? err.stack : undefined,
  });
  sendError(res, HttpStatus.INTERNAL_SERVER_ERROR, "Internal server error");
}
