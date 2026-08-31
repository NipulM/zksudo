import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyResultV2,
} from "aws-lambda";
import { RouteMatcher } from "../utils/route.matcher.js";
import type { RouteDefinition } from "../types/route.type.js";
import { ResponseBuilder } from "../utils/response-builder.js";
import { AppService } from "../services/app.service.js";
import {
  EnrollPayloadSchema,
  NoncePayloadSchema,
  VerifyPayloadSchema,
  type EnrollPayload,
  type NoncePayload,
  type VerifyPayload,
} from "../types/validation-schemas.js";
import { ValidationUtil } from "../utils/validation.js";
import { AuthMiddleware } from "../middleware/auth.middleware.js";

export class AppRouter {
  private routes: RouteDefinition[] = [];
  private appService: AppService;
  private authMiddleware: AuthMiddleware;

  constructor() {
    this.appService = new AppService();
    this.authMiddleware = new AuthMiddleware();
    this.initializeRoutes();
  }

  private initializeRoutes(): void {
    this.routes = [
      {
        path: "/health",
        method: "GET",
        handler: (_event, _userId) => this.healthHandler(),
      },
      {
        path: "/enroll",
        method: "POST",
        handler: (event, _userId) => this.enrollHandler(event),
      },
      {
        path: "/nonce",
        method: "POST",
        handler: (event, _userId) => this.nonceHandler(event),
      },
      {
        path: "/verify",
        method: "POST",
        handler: (event, _userId) => this.verifyHandler(event),
      },
    ];
  }

  async route(
    event: APIGatewayProxyEventV2,
    userId: string,
  ): Promise<APIGatewayProxyResultV2> {
    const route = RouteMatcher.matchRouteWithQuery(this.routes, event);

    if (route) {
      return route.handler(event, userId);
    }

    return ResponseBuilder.notFound(`Route not found: ${event.rawPath}`);
  }

  private healthHandler(): Promise<APIGatewayProxyResultV2> {
    return this.appService.health();
  }

  private async enrollHandler(
    event: APIGatewayProxyEventV2,
  ): Promise<APIGatewayProxyResultV2> {
    if (!event.body) {
      return ResponseBuilder.error("Request body is required", 400);
    }

    const payload = JSON.parse(event.body) as EnrollPayload;
    const validationResult = ValidationUtil.validate(
      EnrollPayloadSchema,
      payload,
    );

    if (!validationResult.success || !validationResult.data) {
      return ValidationUtil.createValidationErrorResponse(
        validationResult.errors ?? ["Invalid payload"],
      );
    }

    // update - t3 (forward the proof-of-possession + bootstrap token to the
    // now-authenticated enrol flow.)
    const { publicHash, roleArn, proof, publicInputs, enrollToken } =
      validationResult.data;

    return this.appService.enroll(
      publicHash,
      roleArn,
      proof,
      publicInputs,
      enrollToken,
    );
  }

  private async nonceHandler(
    event: APIGatewayProxyEventV2,
  ): Promise<APIGatewayProxyResultV2> {
    if (!event.body) {
      return ResponseBuilder.error("Request body is required", 400);
    }

    const payload = JSON.parse(event.body) as NoncePayload;
    const validationResult = ValidationUtil.validate(
      NoncePayloadSchema,
      payload,
    );

    if (!validationResult.success || !validationResult.data) {
      return ValidationUtil.createValidationErrorResponse(
        validationResult.errors ?? ["Invalid payload"],
      );
    }

    const { publicHash } = validationResult.data;
    await this.authMiddleware.validateRequest(publicHash);

    return this.appService.nonce(publicHash);
  }

  private async verifyHandler(
    event: APIGatewayProxyEventV2,
  ): Promise<APIGatewayProxyResultV2> {
    if (!event.body) {
      return ResponseBuilder.error("Request body is required", 400);
    }

    const payload = JSON.parse(event.body) as VerifyPayload;
    const validationResult = ValidationUtil.validate(
      VerifyPayloadSchema,
      payload,
    );

    if (!validationResult.success || !validationResult.data) {
      return ValidationUtil.createValidationErrorResponse(
        validationResult.errors ?? ["Invalid payload"],
      );
    }

    const { publicHash, proof, publicInputs } = validationResult.data;
    await this.authMiddleware.validateRequest(publicHash);

    return this.appService.verify(publicHash, proof, publicInputs);
  }
}
