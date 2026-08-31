function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function optional(name: string, fallback: string): string {
  return process.env[name] ?? fallback;
}

export const env = {
  stage: optional("STAGE", "dev"),
  region: optional("AWS_REGION", "us-east-1"),
  enrollTokensTableName: required("ENROLL_TOKENS_TABLE_NAME"),

  // for iam
  controllerLambdaRoleName: required("EXECUTION_ROLE_NAME"),
  assumeRolePolicyName: required("ASSUME_ROLE_POLICY_NAME"),

  // Default: 1 hour window for an admin to hand the bootstrap token to a developer.
  tokenTtlSeconds: parseInt(optional("TOKEN_TTL_SECONDS", "3600"), 10),
  logLevel: optional("LOG_LEVEL", "info"),
  isLocal: optional("STAGE", "dev") === "local",
} as const;
