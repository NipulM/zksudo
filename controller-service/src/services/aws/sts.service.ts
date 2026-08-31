import { STSClient, AssumeRoleCommand } from "@aws-sdk/client-sts";

export class StsService {
  private client: STSClient;

  constructor() {
    this.client = new STSClient({});
  }

  async assumeRole(roleArn: string, sessionName: string) {
    const command = new AssumeRoleCommand({
      RoleArn: roleArn,
      RoleSessionName: sessionName,
      DurationSeconds: 900,
    });

    const response = await this.client.send(command);
    return response.Credentials;
  }
}
