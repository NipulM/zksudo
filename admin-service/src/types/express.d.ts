import "express";
import type {
  APIGatewayProxyEventV2WithJWTAuthorizer,
  Context,
} from "aws-lambda";
import type { AdminIdentity } from "./token.types";

declare module "express-serve-static-core" {
  interface Request {
    apiGateway?: {
      event: APIGatewayProxyEventV2WithJWTAuthorizer;
      context: Context;
    };
    admin?: AdminIdentity;
  }
}
