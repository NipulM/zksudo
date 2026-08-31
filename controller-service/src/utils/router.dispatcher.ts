import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyResultV2,
} from "aws-lambda";
import { ResponseBuilder } from "./response-builder.js";

export interface Routable {
  route(
    event: APIGatewayProxyEventV2,
    userId: string,
  ): Promise<APIGatewayProxyResultV2>;
}

export function getPathSegment(rawPath: string): string | null {
  const segments = rawPath.split("/").filter(Boolean);
  return segments.length > 0 ? (segments[0] ?? null) : null;
}

export class RouterDispatcher {
  private routers: Map<string, Routable>;

  constructor(routers: Record<string, Routable>) {
    this.routers = new Map(Object.entries(routers));
  }

  async dispatch(
    event: APIGatewayProxyEventV2,
    userId: string,
  ): Promise<APIGatewayProxyResultV2> {
    const segment = getPathSegment(event.rawPath ?? "/");

    if (!segment) {
      return ResponseBuilder.notFound("No path segment to route");
    }

    const router = this.routers.get(segment);
    if (!router) {
      return ResponseBuilder.notFound(
        `No router for path segment: ${segment}.`,
      );
    }

    return router.route(event, userId);
  }
}
