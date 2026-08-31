import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";

export class S3Service {
  private client: S3Client;
  private bucket: string;

  constructor() {
    this.client = new S3Client({});
    this.bucket = process.env.CIRCUIT_ARTIFACTS_BUCKET_NAME ?? "";
  }

  async getCircuitArtifact(key: string): Promise<Buffer> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    const response = await this.client.send(command);
    const bytes = await response.Body?.transformToByteArray();
    return Buffer.from(bytes ?? []);
  }
}
