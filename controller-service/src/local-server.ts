import express from "express";
import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { handler } from "./index.js";

const app = express();
app.use(express.text({ type: "*/*" })); // capture raw body as string

app.all("/*splat", async (req, res) => {
  const event: APIGatewayProxyEventV2 = {
    version: "2.0",
    routeKey: `${req.method} ${req.path}`,
    rawPath: req.path,
    rawQueryString: req.url.split("?")[1] ?? "",
    headers: req.headers as Record<string, string>,
    requestContext: {
      http: {
        method: req.method,
        path: req.path,
        protocol: "HTTP/1.1",
        sourceIp: req.ip ?? "127.0.0.1",
        userAgent: req.get("user-agent") ?? "",
      },
    } as any,
    body: typeof req.body === "string" ? req.body : undefined,
    isBase64Encoded: false,
  } as APIGatewayProxyEventV2;

  const result: any = await handler(event, {} as any);

  if (!result) return res.status(204).end();
  res.status(result.statusCode ?? 200);
  if (result.headers) {
    for (const [k, v] of Object.entries(result.headers))
      res.setHeader(k, v as string);
  }
  res.send(result.body ?? "");
});

const port = Number(process.env.PORT ?? 3000);
app.listen(port, () => console.log(`devs gateway → http://localhost:${port}`));
