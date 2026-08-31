import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyResultV2,
} from "aws-lambda";

export interface RouteDefinition {
  path: string;
  method: string;
  handler: (
    event: APIGatewayProxyEventV2,
    userId: string,
  ) => Promise<APIGatewayProxyResultV2>;
}

export interface RouteMatch {
  path: string;
  method: string;
  queryParams?: Record<string, string>;
}
