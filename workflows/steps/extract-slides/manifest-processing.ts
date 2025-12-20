import { db } from "@/db";
import { videoSlides } from "@/db/schema";
import {
  type SlideData,
  type VideoManifest,
  VideoManifestSchema,
} from "@/lib/slides-types";
import type { YouTubeVideoId } from "@/lib/youtube-utils";
import {
  extractSlideTimings,
  filterStaticSegments,
  normalizeIsDuplicate,
} from "./manifest-processing.utils";
import { emitSlide } from "./stream-emitters";

function getBlobStorageRootUrl(): string {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) throw new Error("BLOB_READ_WRITE_TOKEN is not set");
  const storeId = token.split("_")[3];
  const storageRootUrl = `https://${storeId}.public.blob.vercel-storage.com`;
  return storageRootUrl;
}

function getManifestBlobUrl(videoId: string): string {
  const storageRootUrl = getBlobStorageRootUrl();
  return `${storageRootUrl}/manifests/${videoId}.json`;
}

export async function fetchManifest(
  videoId: YouTubeVideoId,
): Promise<VideoManifest> {
  "use step";

  const manifestUrl = getManifestBlobUrl(videoId);

  try {
    const response = await fetch(manifestUrl);

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(
          `Manifest file not found for video ${videoId}. The slide extraction may not have completed yet or failed. URL: ${manifestUrl}`,
        );
      } else {
        throw new Error(
          `Failed to fetch manifest for video ${videoId}. HTTP ${response.status} ${response.statusText}. URL: ${manifestUrl}`,
        );
      }
    }

    let json: unknown;
    try {
      json = await response.json();
    } catch (parseError) {
      throw new Error(
        `Invalid JSON response from manifest for video ${videoId}. The manifest file may be corrupted or incomplete. URL: ${manifestUrl}. Parse error: ${parseError instanceof Error ? parseError.message : String(parseError)}`,
      );
    }

    if (json === null || json === undefined) {
      throw new Error(
        `Manifest file for video ${videoId} contains null/undefined data. The slide extraction may have failed or is incomplete. URL: ${manifestUrl}`,
      );
    }

    if (typeof json !== "object") {
      throw new Error(
        `Manifest file for video ${videoId} should contain an object, but received ${typeof json}: ${JSON.stringify(json).slice(0, 200)}.... URL: ${manifestUrl}`,
      );
    }

    const manifest = VideoManifestSchema.parse(json);
    return manifest;
  } catch (error) {
    // Re-throw Zod errors with more context
    if (
      error &&
      typeof error === "object" &&
      "name" in error &&
      error.name === "ZodError"
    ) {
      const zodError = error as unknown as { errors: unknown[] };
      throw new Error(
        `Manifest validation failed for video ${videoId}. Schema validation errors: ${JSON.stringify(zodError.errors, null, 2)}. This suggests the manifest structure is incorrect. URL: ${manifestUrl}`,
      );
    }

    // Re-throw our custom errors as-is
    if (error instanceof Error) {
      throw error;
    }

    // Wrap unknown errors
    throw new Error(
      `Unexpected error while fetching manifest for video ${videoId}: ${String(error)}. URL: ${manifestUrl}`,
    );
  }
}

export async function processSlidesFromManifest(
  videoId: YouTubeVideoId,
  manifest: VideoManifest,
): Promise<number> {
  "use step";

  console.log(
    `💾 processSlidesFromManifest: Processing slides for video ${videoId}`,
  );

  const videoData = manifest[videoId];
  if (!videoData) {
    console.error(
      `💾 processSlidesFromManifest: No data found for video ${videoId} in manifest`,
      {
        availableVideos: Object.keys(manifest),
        videoId,
      },
    );
    throw new Error(
      `No data for video ${videoId} in manifest - available videos: ${Object.keys(manifest).join(", ")}`,
    );
  }

  const staticSegments = filterStaticSegments(videoData.segments);

  console.log(
    `💾 processSlidesFromManifest: Found ${staticSegments.length} static segments for video ${videoId}`,
  );

  let slideNumber = 1;

  for (const segment of staticSegments) {
    const firstFrame = segment.first_frame;
    const lastFrame = segment.last_frame;

    const timings = extractSlideTimings(segment);

    const slideData: SlideData = {
      slideNumber,
      frameId: firstFrame?.frame_id || lastFrame?.frame_id || null,
      ...timings,
      firstFrameImageUrl: firstFrame.url,
      ...normalizeIsDuplicate(firstFrame, "firstFrame"),

      lastFrameImageUrl: lastFrame.url,
      ...normalizeIsDuplicate(lastFrame, "lastFrame"),
    };

    console.log(
      `💾 processSlidesFromManifest: Saving slide ${slideNumber} to database`,
    );
    await db
      .insert(videoSlides)
      .values({
        videoId,
        ...slideData,
      })
      .onConflictDoNothing();

    console.log(
      `💾 processSlidesFromManifest: Successfully saved slide ${slideNumber} to database`,
    );

    await emitSlide(slideData);
    slideNumber++;
  }

  console.log(
    `💾 processSlidesFromManifest: Slide processing completed for video ${videoId}:`,
    {
      totalSegments: staticSegments.length,
    },
  );

  const totalSlides = slideNumber - 1;
  return totalSlides;
}
