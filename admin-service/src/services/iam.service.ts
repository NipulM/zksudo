// services/iamRoleAccessService.ts
import {
  IAMClient,
  GetRolePolicyCommand,
  PutRolePolicyCommand,
  NoSuchEntityException,
} from "@aws-sdk/client-iam";
import { logger } from "../utils/logger";
import { env } from "../config/env";

const iam = new IAMClient({});

async function getCurrentPolicy(): Promise<PolicyDocument> {
  try {
    const res = await iam.send(
      new GetRolePolicyCommand({
        RoleName: env.controllerLambdaRoleName,
        PolicyName: env.assumeRolePolicyName,
      }),
    );
    const decoded = decodeURIComponent(res.PolicyDocument!);
    return JSON.parse(decoded) as PolicyDocument;
  } catch (err) {
    if (err instanceof NoSuchEntityException) {
      // Policy doesn't exist yet — start from an empty AssumeRole statement.
      return {
        Version: "2012-10-17",
        Statement: [
          { Effect: "Allow", Action: "sts:AssumeRole", Resource: [] },
        ],
      };
    }
    throw err;
  }
}

async function putPolicy(doc: PolicyDocument): Promise<void> {
  await iam.send(
    new PutRolePolicyCommand({
      RoleName: env.controllerLambdaRoleName,
      PolicyName: env.assumeRolePolicyName,
      PolicyDocument: JSON.stringify(doc),
    }),
  );
}

export const iamRoleAccessService = {
  /**
   * Ensures the controller's execution role is permitted to
   * sts:AssumeRole on the given cross-account role ARN. Idempotent —
   * safe to call even if the ARN is already present.
   */
  async ensureAssumeRoleAccess(roleArn: string): Promise<void> {
    const doc = await getCurrentPolicy();
    const stmt = doc.Statement.find((s) => s.Action === "sts:AssumeRole");

    if (!stmt) {
      doc.Statement.push({
        Effect: "Allow",
        Action: "sts:AssumeRole",
        Resource: [roleArn],
      });
    } else if (!stmt.Resource.includes(roleArn)) {
      stmt.Resource.push(roleArn);
    } else {
      logger.info("assume_role_access_already_present", { roleArn });
      return;
    }

    await putPolicy(doc);
    logger.info("assume_role_access_granted", { roleArn });
  },

  /** Optional: mirror removal, e.g. when a token/enrolment is revoked. */
  async revokeAssumeRoleAccess(roleArn: string): Promise<void> {
    const doc = await getCurrentPolicy();
    const stmt = doc.Statement.find((s) => s.Action === "sts:AssumeRole");
    if (!stmt || !stmt.Resource.includes(roleArn)) return;

    stmt.Resource = stmt.Resource.filter((r) => r !== roleArn);
    await putPolicy(doc);
    logger.info("assume_role_access_revoked", { roleArn });
  },
};
