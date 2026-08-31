export interface AdminIdentity {
  sub: string;
  email?: string;
}

/**
 * Shape persisted to the enrol-tokens DynamoDB table. This MUST match the
 * schema your existing Verification Gateway's /enroll handler reads from.
 * If your existing table uses different attribute names, update this
 * interface and token.repository.ts together.
 */
export interface EnrolmentTokenRecord {
  PK: string; // partition key
  SK: string; // ISO 8601
  createdBy: string; // admin's Cognito sub
  expiresAt: number; // epoch seconds — also used as the DynamoDB TTL attribute
  used: boolean;
  roleArn: string; // IAM role ARN this token is bound to at issuance
  note?: string;
}

export interface CreateTokenRequestBody {
  roleArn: string;
  note?: string;
  ttlSeconds?: number;
}

export interface RevokeTokenRequestBody {
  token: string;
}

export interface TokenSummary {
  tokenPreview: string;
  createdAt: string;
  createdBy: string;
  expiresAt: number;
  used: boolean;
  expired: boolean;
  note?: string;
}
