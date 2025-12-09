import { AwsClient } from "aws4fetch";

// ============================================================================
// Config (Restored from Old Code)
// ============================================================================

function getEnv(key: string, fallback?: string): string {
  const value = process.env[key] ?? fallback;
  if (!value) throw new Error(`Missing env: ${key}`);
  return value;
}

export const CONFIG = {
  SLIDES_EXTRACTOR_URL: getEnv("SLIDES_EXTRACTOR_URL"),
  // RESTORED: Specific endpoint for your private S3
  S3_BASE_URL: getEnv("S3_BASE_URL", "https://s3.remtoolz.ai"),
  S3_ACCESS_KEY: getEnv("S3_ACCESS_KEY"),
  S3_SECRET_KEY: getEnv("S3_ACCESS_KEY"), // Your specific setup
  SLIDES_API_PASSWORD: getEnv("SLIDES_API_PASSWORD"),
  // RESTORED: Needed for manual Blob upload
  BLOB_READ_WRITE_TOKEN: getEnv("BLOB_READ_WRITE_TOKEN"),
};

// ============================================================================
// Helpers
// ============================================================================

export function makeAwsClient(): AwsClient {
  return new AwsClient({
    accessKeyId: CONFIG.S3_ACCESS_KEY,
    secretAccessKey: CONFIG.S3_SECRET_KEY,
    service: "s3", // Explicitly set service
    region: "us-east-1",
  });
}
