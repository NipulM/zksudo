import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { HttpError } from "../utils/http-error.js";
import { DynamoDBConnection } from "../database/dynamodb.js";

export class AuthMiddleware {
  private readonly dynamoDBConnection: DynamoDBConnection;

  constructor() {
    this.dynamoDBConnection = new DynamoDBConnection();
  }

  async validateRequest(publicHash: string): Promise<void> {
    // update - t3 (fetch the LATEST enrolment record and honour revocation:
    // an out-of-band active=false flip must block the user everywhere, not
    // just at credential issuance. Previously this only checked existence.)
    const user = await this.dynamoDBConnection.fetchData({
      TableName: "zk-sudo-users-prod",
      ExpressionAttributeValues: {
        ":PK": publicHash,
      },
      KeyConditionExpression: "PK = :PK",
      ScanIndexForward: false,
      Limit: 1,
    });

    const latest = user.Items?.[0];
    if (!latest) {
      throw new HttpError(401, "Authentication required");
    }
    if (latest.active === false) {
      throw new HttpError(403, "Enrolment revoked");
    }
  }
}
