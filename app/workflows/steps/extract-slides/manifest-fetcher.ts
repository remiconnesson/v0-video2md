import { type VideoManifest, VideoManifestSchema } from "@/lib/slides-types";
import { CONFIG, makeAwsClient } from "./config";
import { buildS3HttpUrl, parseS3Uri } from "./manifest-processing.utils";

export async function fetchManifest(s3Uri: string): Promise<VideoManifest> {
  "use step";

  try {
    console.log(`📥 fetchManifest: Fetching manifest from S3 URI: ${s3Uri}`);

    const client = makeAwsClient();
    const parsedS3Uri = parseS3Uri(s3Uri);

    if (!parsedS3Uri) {
      throw new Error(`Invalid S3 URI: ${s3Uri}`);
    }

    const { bucket, key } = parsedS3Uri;
    const httpUrl = buildS3HttpUrl(CONFIG.S3_BASE_URL, bucket, key);

    console.log(
      `📥 fetchManifest: Fetching manifest from HTTP URL: ${httpUrl}`,
    );

    const response = await client.fetch(httpUrl);

    if (!response.ok) {
      const responseText = await response.text();
      const errorDetails = {
        s3Uri,
        httpUrl,
        bucket,
        key,
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        responseBody: responseText,
      };

      console.error(
        "📥 fetchManifest: Failed to fetch manifest:",
        errorDetails,
      );

      throw new Error(
        `Failed to fetch manifest from ${httpUrl}: ` +
          `HTTP ${response.status} ${response.statusText} - ${responseText}`,
      );
    }

    const responseText = await response.text();
    console.log(
      `📥 fetchManifest: Manifest response received, parsing JSON (${responseText.length} chars)`,
    );

    let json: unknown;
    try {
      json = JSON.parse(responseText);
    } catch (parseError) {
      console.error("📥 fetchManifest: Failed to parse manifest JSON:", {
        s3Uri,
        httpUrl,
        responseText:
          responseText.substring(0, 500) +
          (responseText.length > 500 ? "..." : ""),
        parseError:
          parseError instanceof Error ? parseError.message : parseError,
      });
      throw new Error(
        `Failed to parse manifest JSON from ${httpUrl}: ` +
          `${parseError instanceof Error ? parseError.message : "Invalid JSON"}`,
      );
    }

    const manifest = VideoManifestSchema.parse(json);
    console.log(
      `📥 fetchManifest: Manifest parsed successfully, contains ${Object.keys(manifest).length} video entries`,
    );

    return manifest;
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes("Failed to fetch manifest")
    ) {
      throw error;
    }

    console.error(
      `📥 fetchManifest: Unexpected error fetching manifest from ${s3Uri}:`,
      error,
    );
    throw new Error(
      `Unexpected error fetching manifest from ${s3Uri}: ` +
        `${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}
