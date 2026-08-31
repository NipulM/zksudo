import express from "express";
import { router } from "./router";
import { requestLogger } from "./middleware/requestLogger.middleware";
import { errorHandler } from "./middleware/errorHandler.middleware";
import { HttpStatus } from "./enum/httpStatus.enum";

export function createApp() {
  const app = express();

  app.use(express.json());
  app.use(requestLogger);

  // Unauthenticated liveness probe. Deliberately outside /admin/* so it can
  // be wired in API Gateway without the JWT authorizer attached.
  app.get("/health", (_req, res) => {
    res.status(HttpStatus.OK).json({ status: "ok" });
  });

  app.use(router);

  app.use(errorHandler);

  return app;
}
