import { execSync } from "child_process";
import fs from "fs";
import type { APIGatewayProxyResultV2 } from "aws-lambda";
import { ResponseBuilder } from "../utils/response-builder.js";
import { DynamoDBConnection } from "../database/dynamodb.js";
import { StsService } from "./aws/sts.service.js";
import { S3Service } from "./aws/s3.service.js";
import { v4 as uuidv4 } from "uuid";
import { HttpError } from "../utils/http-error.js";

// update - t3 (centralise table names; add the enrol-tokens table backing the
// bootstrap-token gate. Nonce TTL is short-lived; the read-time expiry check
// below does not rely on DynamoDB's (delayed, best-effort) TTL deletion.)
const USERS_TABLE = "zk-sudo-users-prod";
const NONCES_TABLE = "zk-sudo-nonces-prod";
const ENROLL_TOKENS_TABLE = "zk-sudo-enroll-tokens-prod";
const NONCE_TTL_SECONDS = 300; // 5 min — a nonce is a single-use challenge

// update - t3 (shared hex normaliser — was a local const inside verify();
// now reused by both verify() and enroll() so the two proof paths agree.)
const normalizeHex = (s: string) =>
  (s.startsWith("0x") ? s.slice(2) : s).toLowerCase().padStart(64, "0");

export class AppService {
  private sts: StsService;
  private s3: S3Service;
  private readonly dynamoDBConnection: DynamoDBConnection;

  constructor() {
    this.sts = new StsService();
    this.s3 = new S3Service();
    this.dynamoDBConnection = new DynamoDBConnection();
  }

  async health(): Promise<APIGatewayProxyResultV2> {
    return ResponseBuilder.success({ status: "ok" }, 200);
  }

  // update - t3 (proof verification extracted from verify() so enrol can run the
  // same bb verify for proof-of-possession. Throws HttpError(401) on any failure.)
  private verifyProof(proof: string, publicInputs: any): void {
    const bbPath = process.env.BB_BIN ?? "/usr/local/bin/bb";
    const vkPath = process.env.VK_PATH ?? "/var/task/vk";
    const proofPath = "/tmp/proof";

    // proof + public_inputs must live under /tmp (only writable dir in Lambda);
    // bb hardcodes the relative ./target/public_inputs path, so cwd = /tmp.
    fs.writeFileSync(proofPath, Buffer.from(proof, "hex"));

    const targetDir = "/tmp/target";
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    const publicInputsBuffer = Buffer.concat(
      publicInputs.map((input: any) => Buffer.from(normalizeHex(input), "hex")),
    );
    fs.writeFileSync(`${targetDir}/public_inputs`, publicInputsBuffer);

    try {
      execSync(
        `${bbPath} verify --scheme ultra_honk -k ${vkPath} -p ${proofPath}`,
        { stdio: "pipe", cwd: "/tmp" },
      );
    } catch (e: any) {
      console.error("bb verify failed:", {
        message: e.message,
        stderr: e.stderr?.toString(),
        stdout: e.stdout?.toString(),
      });
      throw new HttpError(401, "Invalid proof");
    }
  }

  // update - t3 (enrolment is now authenticated: a valid single-use bootstrap
  // token AND a proof-of-possession that the caller actually holds the secret
  // behind the commitment. The token doubles as the anti-replay nonce baked
  // into the proof, so no separate enrol-nonce round trip is needed. Closes the
  // "anyone can enrol any commitment" hole in the origination claim.)
  async enroll(
    publicHash: string,
    roleArn: string,
    proof: string,
    publicInputs: any,
    enrollToken: string,
  ): Promise<APIGatewayProxyResultV2> {
    // 1. Validate the bootstrap token: must exist, be unused, and unexpired.
    const tokenResult = await this.dynamoDBConnection.fetchData({
      TableName: ENROLL_TOKENS_TABLE,
      KeyConditionExpression: "PK = :PK",
      ExpressionAttributeValues: { ":PK": enrollToken },
      Limit: 1,
    });

    const tokenItem = tokenResult.Items?.[0];
    if (!tokenItem) {
      throw new HttpError(401, "Invalid enrolment token");
    }
    if (tokenItem.used) {
      throw new HttpError(401, "Enrolment token already used");
    }
    if (
      tokenItem.expiresAt &&
      Number(tokenItem.expiresAt) * 1000 < Date.now()
    ) {
      throw new HttpError(401, "Enrolment token expired");
    }

    // 2. Proof must be for THIS commitment, bound to THIS token (as the nonce).
    const claimedCommitment = normalizeHex(publicInputs[0]);
    const claimedNonce = normalizeHex(publicInputs[1]);
    const expectedCommitment = normalizeHex(publicHash);
    const expectedNonce = normalizeHex(enrollToken.replace(/-/g, ""));

    if (claimedCommitment !== expectedCommitment) {
      throw new HttpError(401, "Commitment mismatch");
    }
    if (claimedNonce !== expectedNonce) {
      throw new HttpError(401, "Enrolment token not bound to proof");
    }

    // 3. Proof-of-possession: verify the caller knows the secret behind publicHash.
    this.verifyProof(proof, publicInputs);

    // 4. Spend the token (single-use) before granting the enrolment.
    await this.dynamoDBConnection.updateData({
      TableName: ENROLL_TOKENS_TABLE,
      Key: { PK: tokenItem.PK, SK: tokenItem.SK },
      UpdateExpression: "SET used = :used",
      ExpressionAttributeValues: { ":used": true },
    });

    // 5. Store the user mapping. active=true; flip to false out-of-band to revoke.
    await this.dynamoDBConnection.writeData({
      TableName: USERS_TABLE,
      Item: {
        PK: publicHash,
        SK: new Date().toISOString(),
        roleArn,
        active: true,
        updatedAt: new Date().toISOString(),
      },
    });

    return ResponseBuilder.success({ status: "Enrolled successfully" }, 200);
  }

  async nonce(publicHash: string): Promise<APIGatewayProxyResultV2> {
    const nonce = uuidv4();
    // update - t3 (expiresAt drives DynamoDB TTL cleanup AND the read-time
    // expiry check in verify(); a nonce is only valid for NONCE_TTL_SECONDS.)
    const expiresAt = Math.floor(Date.now() / 1000) + NONCE_TTL_SECONDS;
    const params = {
      TableName: NONCES_TABLE,
      Item: {
        PK: publicHash,
        SK: new Date().toISOString(),
        nonce,
        used: false,
        expiresAt,
      },
    };
    await this.dynamoDBConnection.writeData(params);

    return ResponseBuilder.success({ nonce });
  }

  async verify(
    publicHash: string,
    proof: string,
    publicInputs: any,
  ): Promise<APIGatewayProxyResultV2> {
    // 1. Fetch latest unused nonce for this user
    const nonceResult = await this.dynamoDBConnection.fetchData({
      TableName: NONCES_TABLE,
      KeyConditionExpression: "PK = :PK",
      ExpressionAttributeValues: { ":PK": publicHash },
      ScanIndexForward: false,
      Limit: 1,
    });

    const nonceItem = nonceResult.Items?.[0];
    if (!nonceItem || nonceItem.used) {
      throw new HttpError(401, "No valid nonce found");
    }

    // update - t3 (read-time expiry: reject an expired nonce even if DynamoDB's
    // delayed TTL sweep hasn't deleted the row yet — do not trust TTL for security.)
    if (
      nonceItem.expiresAt &&
      Number(nonceItem.expiresAt) * 1000 < Date.now()
    ) {
      throw new HttpError(401, "Nonce expired");
    }

    // 2. Commitment + nonce must match the proof's public inputs
    const claimedCommitment = normalizeHex(publicInputs[0]);
    const claimedNonce = normalizeHex(publicInputs[1]);
    const expectedCommitment = normalizeHex(publicHash);

    if (claimedCommitment !== expectedCommitment) {
      throw new HttpError(401, "Commitment mismatch");
    }

    const expectedNonceHex = normalizeHex(nonceItem.nonce.replace(/-/g, ""));
    if (claimedNonce !== expectedNonceHex) {
      throw new HttpError(401, "Nonce mismatch");
    }

    // 3. Verify the proof
    this.verifyProof(proof, publicInputs);

    // 4. Mark nonce as used
    await this.dynamoDBConnection.updateData({
      TableName: NONCES_TABLE,
      Key: { PK: publicHash, SK: nonceItem.SK },
      UpdateExpression: "SET used = :used",
      ExpressionAttributeValues: { ":used": true },
    });

    // 5. Fetch latest user enrolment
    const userResult = await this.dynamoDBConnection.fetchData({
      TableName: USERS_TABLE,
      KeyConditionExpression: "PK = :PK",
      ExpressionAttributeValues: { ":PK": publicHash },
      ScanIndexForward: false,
      Limit: 1,
    });

    const user = userResult.Items?.[0];
    if (!user) {
      throw new HttpError(404, "User not found");
    }

    // update - t3 (revocation gate: an out-of-band flip of active=false blocks
    // credential issuance for a lost/stolen device or an offboarded developer.)
    if (user.active === false) {
      throw new HttpError(403, "Enrolment revoked");
    }

    // 6. Assume role and return credentials
    const credentials = await this.sts.assumeRole(
      user.roleArn,
      `devs-session-${publicHash.slice(0, 8)}`,
    );

    if (!credentials) {
      throw new HttpError(500, "Failed to assume role");
    }

    return ResponseBuilder.success({
      AccessKeyId: credentials.AccessKeyId,
      SecretAccessKey: credentials.SecretAccessKey,
      SessionToken: credentials.SessionToken,
    });
  }
}
