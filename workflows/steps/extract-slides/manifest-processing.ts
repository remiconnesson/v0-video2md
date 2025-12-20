import { db } from "@/db";
import { videoSlides } from "@/db/schema";
import {
  type SlideData,
  type VideoManifest,
  VideoManifestSchema,
} from "@/lib/slides-types";
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

export async function fetchManifest(videoId: string): Promise<VideoManifest> {
  "use step";
  const json = await fetch(getManifestBlobUrl(videoId)).then((res) =>
    res.json(),
  );

  const manifest = VideoManifestSchema.parse(json);

  return manifest;
}

export async function processSlidesFromManifest(
  videoId: string,
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

  return slideNumber;
}
