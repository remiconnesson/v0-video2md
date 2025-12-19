import sharp from "sharp";
import { checkJobExists, uploadToBlob } from "./blob-service";
import { getSlideImageQuality } from "./config";
import {
  deleteFile,
  downloadVideoWithYtdl,
  generateVideoFilename,
  getVideoPath,
} from "./downloader";
import { areHashesSimilar } from "./frame-hasher";
import type { FrameMetadata, Segment, StaticSegment } from "./types";
import { analyzeVideo, type DetectedSegment } from "./video-analyzer";

/**
 * Process a YouTube video: download, analyze, extract slides, upload to Vercel Blob.
 */

const getVideoUrl = (videoId: string) =>
  `https://www.youtube.com/watch?v=${videoId}`;

/**
 * Result of video processing
 */
export interface ProcessingResult {
  segments: Segment[];
  totalFrames: number;
  videoDuration: number;
}

/**
 * Find duplicates for a frame by comparing its phash against previous segments.
 * Returns the duplicate reference if found, null otherwise.
 */
function findDuplicate(
  frameHash: string | undefined,
  _framePosition: "first" | "last",
  currentSegmentIndex: number,
  previousStaticSegments: Array<{
    index: number;
    firstFrameHash: string | undefined;
    lastFrameHash: string | undefined;
  }>,
  threshold = 5,
): { segmentId: number; framePosition: "first" | "last" } | null {
  "use step";
  if (!frameHash) return null;

  for (const prev of previousStaticSegments) {
    // Don't compare with self
    if (prev.index >= currentSegmentIndex) continue;

    // Check against first frame of previous segment
    if (
      prev.firstFrameHash &&
      areHashesSimilar(frameHash, prev.firstFrameHash, threshold)
    ) {
      return { segmentId: prev.index, framePosition: "first" };
    }

    // Check against last frame of previous segment
    if (
      prev.lastFrameHash &&
      areHashesSimilar(frameHash, prev.lastFrameHash, threshold)
    ) {
      return { segmentId: prev.index, framePosition: "last" };
    }
  }

  return null;
}

export async function processYouTubeVideo(
  videoId: string,
): Promise<ProcessingResult> {
  "use step";
  let videoPath: string | undefined;

  try {
    // Check if already processed
    const existingManifest = await checkJobExists(videoId);
    if (existingManifest) {
      throw new Error(`Video ${videoId} has already been processed`);
    }

    // Step 1: Download video
    const downloadedVideoPath = await downloadVideo(videoId);
    videoPath = downloadedVideoPath;

    // Step 2: Analyze video
    const analysisResult = await analyzeVideo(downloadedVideoPath, {});

    // Step 3: Process and upload segments
    const segments: Segment[] = [];
    const staticSegmentsForDuplicateCheck: Array<{
      index: number;
      firstFrameHash: string | undefined;
      lastFrameHash: string | undefined;
    }> = [];

    let staticSegmentIndex = 0;
    const totalStaticSegments = analysisResult.segments.filter(
      (s) => s.type === "static" && s.representativeFrameBuffer,
    ).length;

    for (const segment of analysisResult.segments) {
      if (segment.type === "static" && segment.representativeFrameBuffer) {
        const staticSegment = await processStaticSegment(
          videoId,
          segment,
          staticSegmentIndex,
        );

        // Store hash info for duplicate detection
        staticSegmentsForDuplicateCheck.push({
          index: staticSegmentIndex,
          firstFrameHash: segment.representativeFrameHash,
          lastFrameHash: segment.lastFrameHash,
        });

        segments.push(staticSegment);
        staticSegmentIndex++;
      } else {
        // Moving segment
        segments.push({
          kind: "moving",
          startTime: segment.startTime,
          endTime: segment.endTime,
          duration: segment.endTime - segment.startTime,
        });
      }
    }

    // Step 4: Detect duplicates
    detectDuplicates(segments, staticSegmentsForDuplicateCheck);

    console.log(`Successfully processed video ${videoId}`);

    return {
      segments,
      totalFrames: analysisResult.totalFrames,
      videoDuration: analysisResult.videoDuration,
    };
  } catch (error: unknown) {
    console.error(
      `Failed to process video ${videoId}:`,
      error instanceof Error ? error.message : String(error),
    );
    throw error;
  } finally {
    // Cleanup downloaded video
    if (videoPath) {
      await deleteFile(videoPath);
    }
  }
}

/**
 * Process a single static segment: convert frames to webp and upload to blob storage.
 */
async function processStaticSegment(
  videoId: string,
  segment: DetectedSegment,
  index: number,
): Promise<StaticSegment> {
  "use step";
  // Convert and upload first frame
  const firstFrameWebp = await sharp(segment.representativeFrameBuffer!)
    .webp({ quality: getSlideImageQuality() })
    .toBuffer();

  const firstFramePath = `slides/${videoId}/frame_${String(index).padStart(4, "0")}_first.webp`;
  const firstFrameUrl = await uploadToBlob(
    firstFrameWebp,
    firstFramePath,
    "image/webp",
  );

  // Convert and upload last frame (if different)
  let lastFrameUrl = firstFrameUrl;
  let lastFramePath = firstFramePath;
  let lastFramePhash = segment.representativeFrameHash ?? "";

  if (
    segment.lastFrameBuffer &&
    segment.lastFrameBuffer !== segment.representativeFrameBuffer
  ) {
    const lastFrameWebp = await sharp(segment.lastFrameBuffer)
      .webp({ quality: getSlideImageQuality() })
      .toBuffer();

    lastFramePath = `slides/${videoId}/frame_${String(index).padStart(4, "0")}_last.webp`;
    lastFrameUrl = await uploadToBlob(
      lastFrameWebp,
      lastFramePath,
      "image/webp",
    );
    lastFramePhash = segment.lastFrameHash ?? "";
  }

  const firstFrame: FrameMetadata = {
    frameId: `${videoId}_${index}_first`,
    phash: segment.representativeFrameHash ?? "",
    duplicateOf: null, // Will be set during duplicate detection
    skipReason: null,
    blobPath: firstFramePath,
    url: firstFrameUrl,
  };

  const lastFrame: FrameMetadata = {
    frameId: `${videoId}_${index}_last`,
    phash: lastFramePhash,
    duplicateOf: null, // Will be set during duplicate detection
    skipReason: null,
    blobPath: lastFramePath,
    url: lastFrameUrl,
  };

  return {
    kind: "static",
    startTime: segment.startTime,
    endTime: segment.endTime,
    duration: segment.endTime - segment.startTime,
    firstFrame,
    lastFrame,
    url: firstFrameUrl,
  };
}

/**
 * Detect duplicates across all static segments and update the duplicateOf field.
 */
function detectDuplicates(
  segments: Segment[],
  hashInfo: Array<{
    index: number;
    firstFrameHash: string | undefined;
    lastFrameHash: string | undefined;
  }>,
): void {
  "use step";
  let staticIndex = 0;

  for (const segment of segments) {
    if (segment.kind !== "static") continue;

    const info = hashInfo[staticIndex];
    if (!info) {
      staticIndex++;
      continue;
    }

    // Check first frame for duplicates
    if (segment.firstFrame) {
      const duplicate = findDuplicate(
        info.firstFrameHash,
        "first",
        staticIndex,
        hashInfo,
      );
      if (duplicate) {
        segment.firstFrame.duplicateOf = duplicate;
      }
    }

    // Check last frame for duplicates
    if (segment.lastFrame) {
      const duplicate = findDuplicate(
        info.lastFrameHash,
        "last",
        staticIndex,
        hashInfo,
      );
      if (duplicate) {
        segment.lastFrame.duplicateOf = duplicate;
      }
    }

    staticIndex++;
  }
}

async function downloadVideo(videoId: string): Promise<string> {
  "use step";
  const filename = generateVideoFilename("video", videoId);
  const videoPath = getVideoPath(filename);
  const videoUrl = getVideoUrl(videoId);

  const downloadResult = await downloadVideoWithYtdl(videoUrl, videoPath);
  if (!downloadResult.success) {
    throw new Error(`Download failed: ${downloadResult.error}`);
  }
  return videoPath;
}
