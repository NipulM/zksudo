import serverlessHttp from "serverless-http";
import { createApp } from "./app";

const app = createApp();

export const handler = serverlessHttp(app, {
  // Exposes the raw API Gateway event (incl. requestContext.authorizer.jwt)
  // on req.apiGateway so auth.middleware.ts can read the Cognito claims.
  request(request: any, event: any, context: any) {
    request.apiGateway = { event, context };
  },
});
