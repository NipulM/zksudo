import {
  DeleteCommand,
  GetCommand,
  PutCommand,
  ScanCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { dynamoClient } from "../database/dynamoClient";
import { env } from "../config/env";
import { EnrolmentTokenRecord } from "../types/token.types";

const TABLE_NAME = env.enrollTokensTableName;

export const tokenRepository = {
  async put(record: EnrolmentTokenRecord): Promise<void> {
    await dynamoClient.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: record,
        // Defensive: a token value collision should never silently overwrite
        // an existing record. At 256 bits of entropy this should never fire.
        ConditionExpression: "attribute_not_exists(#token)",
        ExpressionAttributeNames: { "#token": "token" },
      }),
    );
  },

  async get(token: string): Promise<EnrolmentTokenRecord | undefined> {
    const result = await dynamoClient.send(
      new GetCommand({ TableName: TABLE_NAME, Key: { token } }),
    );
    return result.Item as EnrolmentTokenRecord | undefined;
  },

  async markUsed(token: string): Promise<void> {
    await dynamoClient.send(
      new UpdateCommand({
        TableName: TABLE_NAME,
        Key: { token },
        UpdateExpression: "SET used = :true",
        ExpressionAttributeValues: { ":true": true },
      }),
    );
  },

  async delete(token: string): Promise<void> {
    await dynamoClient.send(
      new DeleteCommand({ TableName: TABLE_NAME, Key: { token } }),
    );
  },

  /**
   * FYP-scale listing — a Scan is fine at this table size. If this table
   * ever grows large, add a GSI on createdAt and Query it instead.
   */
  async listAll(): Promise<EnrolmentTokenRecord[]> {
    const result = await dynamoClient.send(
      new ScanCommand({ TableName: TABLE_NAME }),
    );
    return (result.Items ?? []) as EnrolmentTokenRecord[];
  },
};
