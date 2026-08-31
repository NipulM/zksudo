# zk-sudo Admin Lambda

Issues and manages single-use enrolment bootstrap tokens, consumed by
`devs enroll --token <t> --role-arn <arn>` on the CLI side.

## ⚠️ Before deploying: check the DynamoDB schema

This service was written to match the `enrol-tokens` table schema as
*described in the report* (`token` as partition key, `used` boolean,
`expiresAt` as the TTL attribute). I don't have the source of your existing
Verification Gateway's `/enroll` handler, so **please confirm the attribute
names actually match** before wiring this up against your real table.
If they differ, update:

- `src/types/token.types.ts` → `EnrolmentTokenRecord`
- `src/repositories/token.repository.ts`

That's it — nothing else touches the schema.

## Structure

```
src/
  config/       env.ts, aws.ts
  database/     dynamoClient.ts
  enum/         httpStatus.enum.ts
  middleware/   auth, errorHandler, requestLogger, validate
  repositories/ token.repository.ts
  router/       index.ts, v1/admin.router.ts
  services/     token.service.ts
  types/        token.types.ts, express.d.ts
  utils/        logger.ts, response.ts
  app.ts        Express app factory (shared by Lambda handler + local dev)
  index.ts      Lambda entry point (exports `handler`)
  local.ts      Local dev server entry (not deployed)
```

## Environment variables to set on the Lambda

| Variable            | Required | Default | Notes                                                                 |
|----------------------|----------|---------|------------------------------------------------------------------------|
| `TOKENS_TABLE_NAME`  | **Yes**  | —       | Name of the `enrol-tokens` DynamoDB table. Lambda throws on cold start if unset. |
| `TOKEN_TTL_SECONDS`  | No       | `3600`  | Default token lifetime. Can be overridden per-request up to a hard cap of 24h. |
| `STAGE`              | No       | `dev`   | Set to `local` only for local dev — this bypasses the Cognito claim check. Never set this to `local` in a deployed environment. |
| `LOG_LEVEL`          | No       | `info`  | `debug` \| `info` \| `warn` \| `error`                                 |

`AWS_REGION` is provided automatically by the Lambda runtime — don't set it manually.

## IAM permissions the Lambda's execution role needs

On the `enrol-tokens` table ARN:
- `dynamodb:PutItem`
- `dynamodb:GetItem`
- `dynamodb:DeleteItem`
- `dynamodb:UpdateItem`
- `dynamodb:Scan`

Nothing else — no STS, no other tables.

## API Gateway wiring (HTTP API)

All three routes hit the same Lambda (Express does the internal routing).
Two ways to wire it — pick whichever is less clicking in your console:

**Option A — one catch-all route (simplest):**
```
ANY /admin/{proxy+}  →  this Lambda, protected by the Cognito JWT authorizer
```

**Option B — explicit routes:**
```
POST /admin/tokens          → this Lambda, JWT authorizer
GET  /admin/tokens           → this Lambda, JWT authorizer
POST /admin/tokens/revoke   → this Lambda, JWT authorizer
```

Additionally, **not** behind the authorizer:
```
GET /health  → this Lambda, no auth (liveness probe)
```

The JWT authorizer should point at the `admin_pool` user pool client and
issuer you set up earlier.

## Endpoints

### `POST /admin/tokens`
Creates a new single-use bootstrap token. **The raw token is returned
exactly once, here** — it is never retrievable again after this response.

Request body (all optional):
```json
{ "note": "for Jane's onboarding", "ttlSeconds": 1800 }
```

Response `201`:
```json
{ "success": true, "data": { "token": "a3f9c21b...", "expiresAt": 1755900000 } }
```

### `GET /admin/tokens`
Lists tokens with masked previews only (`a3f9c21b...88d1`), newest first.

### `POST /admin/tokens/revoke`
Body: `{ "token": "<full raw token>" }`. Deletes an unused token early.
Deliberately a `POST` with the token in the body rather than a `DELETE`
with it in the URL, so the raw secret never ends up in access logs.

## Build & deploy

```bash
npm install
npm run package   # typecheck → esbuild bundle → function.zip
```

Upload `function.zip` directly as the Lambda deployment package
(handler: `index.handler`, runtime: Node.js 20.x). No `node_modules`
needed — esbuild bundles everything into one file (~6.5MB unpacked,
~1.7MB zipped).

## Local dev

```bash
STAGE=local TOKENS_TABLE_NAME=zk-sudo-enrol-tokens-dev npm run dev
```

Runs on `http://localhost:4000`. `STAGE=local` makes `requireAdmin` skip
the Cognito claim check and inject a fake `local-dev` admin identity, so
you can hit the endpoints directly with curl/Postman without a real JWT.
Point `TOKENS_TABLE_NAME` at a real (e.g. dev-stage) table, or run
DynamoDB Local if you want to avoid touching AWS entirely.

## Possible follow-ups (not implemented, flagged for your judgement)

- **Bind a token to an intended IAM role ARN at issuance**, rather than
  leaving the role ARN to be chosen by whoever redeems the token in
  `devs enroll`. Right now a captured, unused token could be redeemed
  against any role the caller requests. Binding the role at creation time
  would close that gap — worth considering given how much of the rest of
  this project is about minimizing what a captured artifact can do.
- CORS middleware, if you ever build a browser-based admin panel instead
  of driving this via CLI/Postman.
- MFA on the Cognito admin pool (small config change, mentioned earlier).
