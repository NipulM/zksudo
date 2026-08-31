import { env } from "./env";

// Shared config for any AWS SDK v3 client constructed in this service.
export const awsClientConfig = {
  region: env.region,
  maxAttempts: 3,
} as const;
