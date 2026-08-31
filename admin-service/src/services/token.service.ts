import { randomUUID } from "crypto";
import { env } from "../config/env";
import { tokenRepository } from "../repositories/token.repository";
import {
  AdminIdentity,
  CreateTokenRequestBody,
  EnrolmentTokenRecord,
  TokenSummary,
} from "../types/token.types";
import { AppError } from "../utils/response";
import { HttpStatus } from "../enum/httpStatus.enum";
import { logger } from "../utils/logger";
import { iamRoleAccessService } from "./iam.service";

function generateToken(): string {
  return randomUUID();
}

function previewOf(token: string): string {
  return `${token.slice(0, 8)}...${token.slice(-4)}`;
}

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

export const tokenService = {
  async createToken(
    admin: AdminIdentity,
    body: CreateTokenRequestBody,
  ): Promise<{ token: string; expiresAt: number; roleArn: string }> {
    const ttlSeconds = body.ttlSeconds ?? env.tokenTtlSeconds;
    const token = generateToken();
    const expiresAt = nowSeconds() + ttlSeconds;

    await iamRoleAccessService.ensureAssumeRoleAccess(body.roleArn);

    const record: EnrolmentTokenRecord = {
      PK: token,
      SK: new Date().toISOString(),
      createdBy: admin.sub,
      expiresAt,
      used: false,
      roleArn: body.roleArn,
      note: body.note,
    };

    await tokenRepository.put(record);

    logger.info("enrolment_token_created", {
      createdBy: admin.sub,
      expiresAt,
      roleArn: body.roleArn,
      tokenPreview: previewOf(token),
    });

    // The raw token is returned exactly once, here, at creation time. It is
    // never retrievable again — listings only ever show the masked preview.
    return { token, expiresAt, roleArn: record.roleArn };
  },

  async revokeToken(admin: AdminIdentity, token: string): Promise<void> {
    const existing = await tokenRepository.get(token);
    if (!existing) {
      throw new AppError(HttpStatus.NOT_FOUND, "Token not found");
    }
    if (existing.used) {
      throw new AppError(
        HttpStatus.CONFLICT,
        "Token has already been consumed and cannot be revoked",
      );
    }

    await tokenRepository.delete(token);
    logger.info("enrolment_token_revoked", {
      revokedBy: admin.sub,
      tokenPreview: previewOf(token),
    });
  },

  async listTokens(): Promise<TokenSummary[]> {
    const records = await tokenRepository.listAll();
    const now = nowSeconds();

    return records
      .map((record) => ({
        tokenPreview: previewOf(record.PK),
        createdAt: record.SK,
        createdBy: record.createdBy,
        expiresAt: record.expiresAt,
        used: record.used,
        expired: record.expiresAt < now,
        roleArn: record.roleArn,
        note: record.note,
      }))
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  },
};
