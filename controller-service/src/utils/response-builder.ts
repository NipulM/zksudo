import type { APIGatewayProxyResultV2 } from "aws-lambda";

export interface ApiResponse<T = any> {
  data?: T;
  error?: string;
  message?: string;
}

export class ResponseBuilder {
  /**
   * Build a successful response
   */
  static success<T>(
    data: T,
    statusCode: number = 200,
  ): APIGatewayProxyResultV2 {
    return {
      statusCode,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        data,
      } as ApiResponse<T>),
    };
  }

  /**
   * Build an error response
   */
  static error(
    message: string,
    statusCode: number = 400,
    details?: Record<string, any>,
  ): APIGatewayProxyResultV2 {
    return {
      statusCode,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message,
        ...(details && { details }),
      }),
    };
  }

  /**
   * Build a not found response
   */
  static notFound(
    message: string = "Resource not found",
  ): APIGatewayProxyResultV2 {
    return this.error(message, 404);
  }

  /**
   * Build a created response
   */
  static created<T>(data: T): APIGatewayProxyResultV2 {
    return this.success(data, 201);
  }

  /**
   * Build a no content response
   */
  static noContent(): APIGatewayProxyResultV2 {
    return {
      statusCode: 204,
      headers: {
        "Content-Type": "application/json",
      },
    };
  }

  /**
   * Build a conflict response
   */
  static conflict(
    message: string = "Resource conflict",
  ): APIGatewayProxyResultV2 {
    return this.error(message, 409);
  }

  /**
   * Build a bad request response
   */
  static badRequest(message: string = "Bad request"): APIGatewayProxyResultV2 {
    return this.error(message, 400);
  }
}
