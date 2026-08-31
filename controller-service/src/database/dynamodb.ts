import {
  PutCommand,
  type PutCommandInput,
  QueryCommand,
  type QueryCommandInput,
  type QueryCommandOutput,
  ScanCommand,
  type ScanCommandInput,
  type ScanCommandOutput,
  UpdateCommand,
  type UpdateCommandInput,
  DynamoDBDocumentClient,
  type DeleteCommandInput,
  DeleteCommand,
  type UpdateCommandOutput,
} from "@aws-sdk/lib-dynamodb";

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";

export class DynamoDBConnection {
  private client: DynamoDBDocumentClient;

  constructor() {
    const ddbClient = new DynamoDBClient({});
    this.client = DynamoDBDocumentClient.from(ddbClient, {
      marshallOptions: {
        removeUndefinedValues: true, // Remove undefined values
        convertClassInstanceToMap: true, // Convert class instances to maps
      },
      unmarshallOptions: {
        wrapNumbers: false, // Don't wrap numbers in { N: "..." }
      },
    });
  }

  async fetchData(params: QueryCommandInput): Promise<QueryCommandOutput> {
    try {
      return await this.client.send(new QueryCommand(params));
    } catch (error) {
      console.error("DATABASE_OPERATION_FAILED", {
        error: error,
        params: params,
      } as any);
      throw new Error("DATABASE_OPERATION_FAILED");
    }
  }

  async scanData(params: ScanCommandInput): Promise<ScanCommandOutput> {
    console.log("scanData called", { TableName: params.TableName });
    try {
      const result = await this.client.send(new ScanCommand(params));
      console.log("scanData success", { itemCount: result.Items?.length ?? 0 });
      return result;
    } catch (error) {
      console.error("DATABASE_OPERATION_FAILED (scanData)", {
        error: error,
        params: params,
      } as any);
      throw new Error("DATABASE_OPERATION_FAILED");
    }
  }

  async writeData(params: PutCommandInput): Promise<boolean> {
    try {
      await this.client.send(new PutCommand(params));
      return true;
    } catch (error: any) {
      console.error("DATABASE_OPERATION_FAILED", {
        error: error,
        params: params,
      });

      if (error.name === "ConditionalCheckFailedException") {
        throw new Error(
          "A record with this identifier already exists. Please use a different value.",
        );
      }

      throw new Error("DATABASE_OPERATION_FAILED");
    }
  }

  async deleteData(params: DeleteCommandInput): Promise<boolean> {
    try {
      await this.client.send(new DeleteCommand(params));
      return true;
    } catch (error) {
      console.error("DATABASE_OPERATION_FAILED", {
        error: error,
        params: params,
      });
      throw new Error("DATABASE_OPERATION_FAILED");
    }
  }

  async updateData(params: UpdateCommandInput): Promise<boolean> {
    try {
      await this.client.send(new UpdateCommand(params));
      return true;
    } catch (error) {
      console.error("DATABASE_OPERATION_FAILED", {
        error: error,
        params: { ...params },
      });
      throw new Error("DATABASE_OPERATION_FAILED");
    }
  }

  async updateDataWithReturn(
    params: UpdateCommandInput,
  ): Promise<UpdateCommandOutput> {
    try {
      const result = await this.client.send(new UpdateCommand(params));
      return result;
    } catch (error) {
      console.error("DATABASE_OPERATION_FAILED", {
        error: error,
        params: { ...params },
      });
      throw new Error("DATABASE_OPERATION_FAILED");
    }
  }
}
