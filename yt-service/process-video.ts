import sharp from "sharp";
import { getSlideImageQuality } from "./config";
import {
	deleteFile,
	downloadVideoWithYtdl,
	generateVideoFilename,
	getVideoPath,
} from "./downloader";
import type { FrameMetadata, Segment } from "./types";
import { analyzeVideo } from "./video-analyzer";
import { uploadToBlob, checkJobExists } from "./blob-service";

/**
 * Process a YouTube video: download, analyze, extract slides, upload to Vercel Blob.
 */

const getVideoUrl = (videoId: string) =>
	`https://www.youtube.com/watch?v=${videoId}`;

export async function processYouTubeVideo(videoId: string): Promise<void> {
	let videoPath: string | undefined;

	try {
		// Check if already processed
		const existingManifest = await checkJobExists(videoId);
		if (existingManifest) {
			return;
		}

		const downloadedVideoPath = await downloadVideo(videoId);

		const analysisResult = await analyzeVideo(
			downloadedVideoPath,
			{},
			(current, total, segmentCount) => {
				console.log(
					`Analyzing frames... ${current}/${total} (${segmentCount} segments)`,
				);
			},
		);

		const segments: Segment[] = [];

		analysisResult.segments.forEach(async (segment, i) => {
			if (segment.type === "static" && segment.representativeFrameBuffer) {
				// Convert and upload first frame
				const firstFrameWebp = await sharp(segment.representativeFrameBuffer)
					.webp({ quality: getSlideImageQuality() })
					.toBuffer();

				const firstFramePath = `slides/${videoId}/frame_${String(i).padStart(4, "0")}_first.webp`;
				const firstFrameUrl = await uploadToBlob(
					firstFrameWebp,
					firstFramePath,
					"image/webp",
				);

				// Convert and upload last frame (if different)
				let lastFrameUrl = firstFrameUrl;
				let lastFramePath = firstFramePath;

				if (
					segment.lastFrameBuffer &&
					segment.lastFrameBuffer !== segment.representativeFrameBuffer
				) {
					const lastFrameWebp = await sharp(segment.lastFrameBuffer)
						.webp({ quality: getSlideImageQuality() })
						.toBuffer();

					lastFramePath = `slides/${videoId}/frame_${String(i).padStart(4, "0")}_last.webp`;
					lastFrameUrl = await uploadToBlob(
						lastFrameWebp,
						lastFramePath,
						"image/webp",
					);
				}

				const firstFrame: FrameMetadata = {
					frameId: `${videoId}_${i}_first`,
					hasText: false, // Skipping text detection for MVP
					textConfidence: 0,
					textTotalAreaRatio: 0,
					textLargestAreaRatio: 0,
					textBoxCount: 0,
					duplicateOf: null,
					skipReason: null,
					blobPath: firstFramePath,
					url: firstFrameUrl,
				};

				const lastFrame: FrameMetadata = {
					frameId: `${videoId}_${i}_last`,
					hasText: false,
					textConfidence: 0,
					textTotalAreaRatio: 0,
					textLargestAreaRatio: 0,
					textBoxCount: 0,
					duplicateOf: null,
					skipReason: null,
					blobPath: lastFramePath,
					url: lastFrameUrl,
				};

				segments.push({
					kind: "static",
					startTime: segment.startTime,
					endTime: segment.endTime,
					duration: segment.endTime - segment.startTime,
					firstFrame,
					lastFrame,
				});

				console.log(
					`Uploading slides... ${i + 1}/${analysisResult.segments.length}`,
				);
			} else {
				// Moving segment
				segments.push({
					kind: "moving",
					startTime: segment.startTime,
					endTime: segment.endTime,
					duration: segment.endTime - segment.startTime,
				});
			}
		});

		// Step 4: Upload manifest
		console.log(`Saving manifest...`);

		// const manifest = {
		// 	[videoId]: {
		// 		segments,
		// 		updatedAt: new Date().toISOString(),
		// 	},
		// };

		// const manifestKey = `slides/${videoId}/manifest.json`;
		// const manifestS3Uri = await uploadToS3(
		// 	Buffer.from(JSON.stringify(manifest, null, 2)),
		// 	manifestKey,
		// 	"application/json",
		// );

		console.log(`Successfully processed video ${videoId}`);
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

async function downloadVideo(videoId: string) {
	const filename = generateVideoFilename("video", videoId);
	const videoPath = getVideoPath(filename);
	const videoUrl = getVideoUrl(videoId);

	const downloadResult = await downloadVideoWithYtdl(
		videoUrl,
		videoPath,
		(progress) => {
			console.log(`Downloading video... ${Math.floor(progress * 100)}%`);
		},
	);
	if (!downloadResult.success) {
		throw new Error(`Download failed: ${downloadResult.error}`);
	}
	return videoPath;
}
