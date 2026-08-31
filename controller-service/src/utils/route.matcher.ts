import type { APIGatewayProxyEventV2 } from "aws-lambda";
import type { RouteDefinition } from "../types/route.type.js";

export class RouteMatcher {
  static matchRouteWithQuery(
    routes: RouteDefinition[],
    event: APIGatewayProxyEventV2,
    queryParam?: string,
  ): RouteDefinition | null {
    const { routeKey } = event;

    return (
      routes.find((route) => {
        const pathMatch = `${route.method} ${route.path}` === routeKey;

        return pathMatch;
      }) || null
    );
  }
}
