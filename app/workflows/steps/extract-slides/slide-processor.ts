import type { AwsClient } from "aws4fetch";
import type {
  FrameMetadata,
  SlideData,
  StaticSegment,
  VideoManifest,
} from "@/lib/slides-types";
import { CONFIG, makeAwsClient } from "./config";
import {
  buildS3HttpUrl,
  extractSlideTimings,
  filterStaticSegments,
  generateBlobPath,
  hasUsableFrames,
  normalizeFrameMetadata,
  parseS3Uri,
} from "./manifest-processing.utils";
import { persistSlide } from "./slide-persistence";

async function uploadFrameImage(
  frame: FrameMetadata,
  frameType: "first" | "last",
  videoId: string,
  slideIndex: number,
  client: AwsClient,
): Promise<string> {
  console.log(
    `💾 processSlidesFromManifest: Processing ${frameType} frame for slide ${slideIndex} (frame: ${frame.frame_id})`,
  );

  if (!frame.s3_uri) {
    throw new Error(`${frameType} frame missing S3 URI`);
  }
  const parsedS3Uri = parseS3Uri(frame.s3_uri);

  if (!parsedS3Uri) {
    throw new Error(`${frameType} frame has invalid S3 URI format`);
  }

  const s3Url = buildS3HttpUrl(
    CONFIG.S3_BASE_URL,
    parsedS3Uri.bucket,
    parsedS3Uri.key,
  );

  console.log(
    `💾 processSlidesFromManifest: Downloading ${frameType} frame image from S3: ${s3Url}`,
  );

  const imageResponse = await client.fetch(s3Url);

  if (!imageResponse.ok) {
    const errorText = await imageResponse.text();
    throw new Error(
      `S3 download failed: HTTP ${imageResponse.status} ${imageResponse.statusText} - ${errorText}`,
    );
  }

  const imageBuffer = await imageResponse.arrayBuffer();
  console.log(
    `💾 processSlidesFromManifest: Downloaded ${frameType} frame image (${imageBuffer.byteLength} bytes), uploading to Vercel Blob`,
  );

  const blobPath = generateBlobPath(
    videoId,
    frame.frame_id,
    slideIndex,
    frameType,
  );
  const blobUrl = `https://blob.vercel-storage.com/${blobPath}`;

  const blobResponse = await fetch(blobUrl, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${CONFIG.BLOB_READ_WRITE_TOKEN}`,
      "Content-Type": "image/webp",
      "x-api-version": "7",
    },
    body: imageBuffer,
  });

  if (!blobResponse.ok) {
    const blobErrorText = await blobResponse.text();
    throw new Error(
      `Blob upload failed: HTTP ${blobResponse.status} ${blobResponse.statusText} - ${blobErrorText}`,
    );
  }

  const blobResult = (await blobResponse.json()) as { url: string };
  const publicImageUrl = blobResult.url;
  console.log(
    `💾 processSlidesFromManifest: Successfully uploaded ${frameType} frame image to blob: ${publicImageUrl}`,
  );

  return publicImageUrl;
}

function buildSlideData(
  slideIndex: number,
  segment: StaticSegment,
  firstFrame: FrameMetadata | undefined,
  firstFrameImageUrl: string | null,
  lastFrame: FrameMetadata | undefined,
  lastFrameImageUrl: string | null,
  imageProcessingError: string | null,
): SlideData {
  const timings = extractSlideTimings(segment);
  const firstFrameData = normalizeFrameMetadata(
    firstFrame,
    firstFrameImageUrl || null,
  );
  const lastFrameData = normalizeFrameMetadata(
    lastFrame,
    lastFrameImageUrl || null,
  );

  return {
    slideIndex,
    frameId: firstFrame?.frame_id || lastFrame?.frame_id || null,
    ...timings,
    firstFrameImageUrl: firstFrameData.imageUrl,
    firstFrameHasText: firstFrameData.hasText,
    firstFrameTextConfidence: firstFrameData.textConfidence,
    firstFrameIsDuplicate: firstFrameData.isDuplicate,
    firstFrameDuplicateOfSegmentId: firstFrameData.duplicateOfSegmentId,
    firstFrameDuplicateOfFramePosition: firstFrameData.duplicateOfFramePosition,
    firstFrameSkipReason: firstFrameData.skipReason,
    lastFrameImageUrl: lastFrameData.imageUrl,
    lastFrameHasText: lastFrameData.hasText,
    lastFrameTextConfidence: lastFrameData.textConfidence,
    lastFrameIsDuplicate: lastFrameData.isDuplicate,
    lastFrameDuplicateOfSegmentId: lastFrameData.duplicateOfSegmentId,
    lastFrameDuplicateOfFramePosition: lastFrameData.duplicateOfFramePosition,
    lastFrameSkipReason: lastFrameData.skipReason,
    imageProcessingError,
  };
}

async function processSlideFrames(
  videoId: string,
  slideIndex: number,
  segment: StaticSegment,
  client: AwsClient,
): Promise<{
  slideData: SlideData;
  firstFrameImageUrl: string | null;
  lastFrameImageUrl: string | null;
} | null> {
  const { first_frame: firstFrame, last_frame: lastFrame } = segment;

  if (!hasUsableFrames(segment)) {
    console.warn(
      `💾 processSlidesFromManifest: Skipping segment ${slideIndex} for video ${videoId}: missing frames or S3 URIs`,
      {
        segment,
        hasFirstFrame: !!firstFrame,
        hasFirstS3Uri: firstFrame ? !!firstFrame.s3_uri : false,
        hasLastFrame: !!lastFrame,
        hasLastS3Uri: lastFrame ? !!lastFrame.s3_uri : false,
      },
    );
    return null;
  }

  let firstFrameImageUrl = "";
  let lastFrameImageUrl = "";
  let imageProcessingError: string | null = null;

  if (firstFrame?.s3_uri) {
    try {
      firstFrameImageUrl = await uploadFrameImage(
        firstFrame,
        "first",
        videoId,
        slideIndex,
        client,
      );
    } catch (e) {
      console.error(
        `💾 processSlidesFromManifest: Failed to process first frame for slide ${slideIndex}:`,
        e,
      );
      imageProcessingError =
        (imageProcessingError ? `${imageProcessingError}; ` : "") +
        (e instanceof Error ? e.message : "Unknown error");
    }
  }

  if (lastFrame?.s3_uri) {
    try {
      lastFrameImageUrl = await uploadFrameImage(
        lastFrame,
        "last",
        videoId,
        slideIndex,
        client,
      );
    } catch (e) {
      console.error(
        `💾 processSlidesFromManifest: Failed to process last frame for slide ${slideIndex}:`,
        e,
      );
      imageProcessingError =
        (imageProcessingError ? `${imageProcessingError}; ` : "") +
        (e instanceof Error ? e.message : "Unknown error");
    }
  }

  return {
    slideData: buildSlideData(
      slideIndex,
      segment,
      firstFrame,
      firstFrameImageUrl || null,
      lastFrame,
      lastFrameImageUrl || null,
      imageProcessingError,
    ),
    firstFrameImageUrl: firstFrameImageUrl || null,
    lastFrameImageUrl: lastFrameImageUrl || null,
  };
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

  let slideIndex = 0;
  let successfulSlides = 0;
  let failedSlides = 0;
  const client = makeAwsClient();

  for (const segment of staticSegments) {
    const processedSlide = await processSlideFrames(
      videoId,
      slideIndex,
      segment,
      client,
    );
    if (!processedSlide) {
      slideIndex++;
      continue;
    }

    const { slideData, firstFrameImageUrl, lastFrameImageUrl } = processedSlide;

    const persistenceResult = await persistSlide({
      videoId,
      slideIndex,
      segment,
      firstFrame: segment.first_frame,
      lastFrame: segment.last_frame,
      firstFrameImageUrl,
      lastFrameImageUrl,
    });

    if (persistenceResult.success) {
      successfulSlides++;
    } else {
      failedSlides++;
      slideData.firstFrameImageUrl = null;
      slideData.lastFrameImageUrl = null;
      slideData.dbError = persistenceResult.errorMessage ?? null;
    }

    const { emitSlide } = await import("./stream-emitters");
    await emitSlide(slideData);
    slideIndex++;
  }

  console.log(
    `💾 processSlidesFromManifest: Slide processing completed for video ${videoId}:`,
    {
      totalSegments: staticSegments.length,
      successfulSlides,
      failedSlides,
      successRate: `${Math.round((successfulSlides / staticSegments.length) * 100)}%`,
    },
  );

  if (failedSlides > 0) {
    console.warn(
      `💾 processSlidesFromManifest: ${failedSlides} slides failed to process for video ${videoId}, but ${successfulSlides} succeeded`,
    );
  }

  return slideIndex;
}
