import { Response } from "express";
import { HttpStatus } from "../enum/httpStatus.enum";

export class AppError extends Error {
  public readonly statusCode: HttpStatus;
  public readonly details?: unknown;

  constructor(statusCode: HttpStatus, message: string, details?: unknown) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.details = details;
  }
}

export function sendSuccess<T>(
  res: Response,
  data: T,
  statusCode: HttpStatus = HttpStatus.OK,
) {
  return res.status(statusCode).json({ success: true, data });
}

export function sendError(
  res: Response,
  statusCode: HttpStatus,
  message: string,
  details?: unknown,
) {
  return res.status(statusCode).json({
    success: false,
    error: message,
    ...(details ? { details } : {}),
  });
}
