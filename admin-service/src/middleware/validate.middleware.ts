import { NextFunction, Request, Response } from "express";
import { ZodSchema } from "zod";
import { HttpStatus } from "../enum/httpStatus.enum";
import { AppError } from "../utils/response";

export function validateBody(schema: ZodSchema) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      throw new AppError(
        HttpStatus.BAD_REQUEST,
        "Request body failed validation",
        result.error.flatten(),
      );
    }
    req.body = result.data;
    next();
  };
}
