import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyResultV2,
} from "aws-lambda";
import type { Context } from "aws-lambda";
import { RouterDispatcher } from "./utils/router.dispatcher.js";
import { HttpError } from "./utils/http-error.js";
import { AppRouter } from "./routes/app.routes.js";

const appRouter = new AppRouter();

const routerDispatcher = new RouterDispatcher({
  health: appRouter,
  enroll: appRouter,
  nonce: appRouter,
  verify: appRouter,
});

export const handler = async (
  event: APIGatewayProxyEventV2,
  _ctx: Context,
): Promise<APIGatewayProxyResultV2 | void> => {
  console.log(
    "Event new build from Image=====>",
    JSON.stringify(event, null, 2),
  );

  try {
    const apiEvent = event as APIGatewayProxyEventV2;
    console.log("Processing API Gateway event", {
      routeKey: apiEvent.routeKey,
    });

    return await routerDispatcher.dispatch(apiEvent, "unauthenticated");
  } catch (err: any) {
    console.error("Error processing event", err);

    if ("Records" in event) {
      throw err;
    }

    const statusCode = err instanceof HttpError ? err.statusCode : 500;
    const message = err?.message ?? "Internal server error";

    return {
      statusCode,
      body: JSON.stringify({ message }),
    };
  }
};
