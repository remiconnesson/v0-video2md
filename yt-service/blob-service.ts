/**
 * Vercel Blob storage operations.
 * Migrated from S3 storage service.
 */

import { head, put } from "@vercel/blob";
import { getBlobReadWriteToken } from "./config";

/**
 * Get Vercel Blob token.
 * Throws if not configured.
 */
function getBlobToken(): string {
  const token = getBlobReadWriteToken();

  if (!token) {
    throw new Error(
      "Blob configuration missing: BLOB_READ_WRITE_TOKEN required",
    );
  }

  return token;
}

/**
 * Upload data to Vercel Blob.
 * Returns the public URL of the uploaded blob.
 */
export async function uploadToBlob(
  data: Buffer,
  pathname: string,
  contentType = "image/webp",
  metadata?: Record<string, string>,
): Promise<string> {
  const token = getBlobToken();

  const blob = await put(pathname, data, {
    access: "public",
    token,
    contentType,
    addRandomSuffix: false,
    ...(metadata && {
      cacheControlMaxAge: 31536000, // 1 year cache for immutable content
    }),
  });

  return blob.url;
}

/**
 * Check if a blob exists.
 * Returns the public URL if it exists, null otherwise.
 */
export async function checkBlobExists(
  pathname: string,
): Promise<string | null> {
  const token = getBlobToken();

  try {
    const blob = await head(pathname, { token });
    return blob.url;
  } catch (error: any) {
    // Vercel Blob throws BlobNotFoundError when blob doesn't exist
    if (error.message?.includes("not found") || error.statusCode === 404) {
      return null;
    }
    throw error;
  }
}

/**
 * Get public URL for a blob.
 * Since Vercel Blob uses public URLs by default, this returns the blob URL.
 * Note: Unlike S3 presigned URLs, these URLs don't expire.
 */
export async function getPublicUrl(pathname: string): Promise<string> {
  const token = getBlobToken();

  try {
    const blob = await head(pathname, { token });
    return blob.url;
  } catch (error: any) {
    throw new Error(
      `Failed to get public URL for ${pathname}: ${error.message}`,
    );
  }
}

/**
 * Check if a job's manifest already exists in Blob storage.
 * Returns the manifest URL if it exists.
 */
export async function checkJobExists(videoId: string): Promise<string | null> {
  const manifestPath = `slides/${videoId}/manifest.json`;
  return await checkBlobExists(manifestPath);
}
