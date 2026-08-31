import { Router } from "express";
import { z } from "zod";
import { HttpStatus } from "../../enum/httpStatus.enum";
import { requireAdmin } from "../../middleware/auth.middleware";
import { validateBody } from "../../middleware/validate.middleware";
import { tokenService } from "../../services/token.service";
import { sendSuccess } from "../../utils/response";

// Matches arn:aws:iam::<12-digit-account-id>:role/<role-name>
// (also accepts role paths, e.g. role/service-role/foo)
const IAM_ROLE_ARN_REGEX = /^arn:aws:iam::\d{12}:role\/[\w+=,.@-][\w+=,.@/-]*$/;

const createTokenSchema = z.object({
  roleArn: z
    .string()
    .regex(
      IAM_ROLE_ARN_REGEX,
      "roleArn must look like arn:aws:iam::<account-id>:role/<role-name>",
    ),
  note: z.string().max(200).optional(),
  ttlSeconds: z
    .number()
    .int()
    .positive()
    .max(60 * 60 * 24) // hard cap at 24h regardless of what the caller requests
    .optional(),
});

const revokeTokenSchema = z.object({
  token: z.string().min(32),
});

export const adminRouter = Router();

// Every route below sits behind requireAdmin. In production this is a
// defence-in-depth check — API Gateway's Cognito JWT authorizer is the
// actual gate and rejects unauthenticated requests before Lambda runs.
adminRouter.use(requireAdmin);

adminRouter.post(
  "/tokens",
  validateBody(createTokenSchema),
  async (req, res, next) => {
    try {
      const result = await tokenService.createToken(req.admin!, req.body);
      sendSuccess(res, result, HttpStatus.CREATED);
    } catch (err) {
      next(err);
    }
  },
);

adminRouter.get("/tokens", async (_req, res, next) => {
  try {
    const tokens = await tokenService.listTokens();
    sendSuccess(res, { tokens });
  } catch (err) {
    next(err);
  }
});

// POST, not DELETE — keeps the raw token value out of the URL (and
// therefore out of access logs). Body carries the token instead.
adminRouter.post(
  "/tokens/revoke",
  validateBody(revokeTokenSchema),
  async (req, res, next) => {
    try {
      await tokenService.revokeToken(req.admin!, req.body.token);
      sendSuccess(res, { revoked: true });
    } catch (err) {
      next(err);
    }
  },
);
