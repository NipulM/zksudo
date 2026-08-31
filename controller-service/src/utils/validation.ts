import { z, ZodError } from "zod";
import type { APIGatewayProxyResultV2 } from "aws-lambda";
import { ResponseBuilder } from "./response-builder.js";

export interface ValidationResult<T> {
  success: boolean;
  data?: T;
  errors?: string[];
}

export class ValidationUtil {
  /**
   * Validate data against a Zod schema
   */
  static validate<T>(
    schema: z.ZodSchema<T>,
    data: unknown,
  ): ValidationResult<T> {
    try {
      const validatedData = schema.parse(data);
      return {
        success: true,
        data: validatedData,
      };
    } catch (error) {
      if (error instanceof ZodError) {
        const issues = (error as ZodError).issues ?? [];
        const errors = issues.map((err) => {
          const field = err.path.join(".");
          return `${field}: ${err.message}`;
        });

        return {
          success: false,
          errors,
        };
      }

      return {
        success: false,
        errors: ["Validation failed"],
      };
    }
  }

  /**
   * Parse and validate request body
   */
  static parseAndValidate<T>(
    schema: z.ZodSchema<T>,
    body: string | undefined,
  ): ValidationResult<T> {
    if (!body) {
      return {
        success: false,
        errors: ["Request body is required"],
      };
    }

    let parsedData: unknown;
    try {
      parsedData = JSON.parse(body);
    } catch (error) {
      return {
        success: false,
        errors: ["Invalid JSON in request body"],
      };
    }

    return this.validate(schema, parsedData);
  }

  /**
   * Create validation error response
   */
  static createValidationErrorResponse(
    errors: string[],
  ): APIGatewayProxyResultV2 {
    return ResponseBuilder.error("Validation failed", 400, {
      validation_errors: errors,
    });
  }

  /**
   * Validate query parameters
   */
  static validateQueryParams<T>(
    schema: z.ZodSchema<T>,
    queryParams: Record<string, string> | undefined,
  ): ValidationResult<T> {
    if (!queryParams) {
      return {
        success: false,
        errors: ["Query parameters are required"],
      };
    }

    return this.validate(schema, queryParams);
  }

  /**
   * Validate path parameters
   */
  static validatePathParams<T>(
    schema: z.ZodSchema<T>,
    pathParams: Record<string, string> | undefined,
  ): ValidationResult<T> {
    if (!pathParams) {
      return {
        success: false,
        errors: ["Path parameters are required"],
      };
    }

    return this.validate(schema, pathParams);
  }
}
