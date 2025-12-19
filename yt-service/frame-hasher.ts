/**
 * Perceptual hashing for frame deduplication using sharp-phash.
 * Based on: https://www.brand.dev/blog/perceptual-hashing-in-node-js-with-sharp-phash-for-developers
 */

import sharp from "sharp";
import phash from "sharp-phash";
import distance from "sharp-phash/distance";

/**
 * Check if two hashes are similar within threshold.
 * Default threshold of 5 matches Python implementation.
 */
export function areHashesSimilar(
  hash1: string,
  hash2: string,
  threshold = 5,
): boolean {
  "use step";
  return distance(hash1, hash2) <= threshold;
}

function computeCenterCrop(
  width: number,
  height: number,
  centerCropRatio = 0.6,
): { left: number; top: number; cropW: number; cropH: number } {
  "use step";
  // Compute center crop dimensions
  const cropW = Math.max(1, Math.floor(width * centerCropRatio));
  const cropH = Math.max(1, Math.floor(height * centerCropRatio));
  const left = Math.floor((width - cropW) / 2);
  const top = Math.floor((height - cropH) / 2);
  return { left, top, cropW, cropH };
}

/**
 * Compute grid-based hashes for a frame (for more robust comparison).
 * Ported from Python: _compute_frame_hash in video_analyzer.py
 */
export async function computeGridHashes(
  imageBuffer: Buffer,
  gridCols = 4,
  gridRows = 4,
  centerCropRatio = 0.6,
): Promise<string[]> {
  "use step";
  const { width, height } = await sharp(imageBuffer).metadata();

  // Extract center crop
  const { left, top, cropW, cropH } = computeCenterCrop(
    width,
    height,
    centerCropRatio,
  );

  const croppedBuffer = await sharp(imageBuffer)
    .extract({ left, top, width: cropW, height: cropH })
    .toBuffer();

  // Compute cell dimensions
  const cellW = Math.floor(cropW / gridCols);
  const cellH = Math.floor(cropH / gridRows);

  if (cellW === 0 || cellH === 0) {
    throw new Error(
      `Grid dimensions (${gridCols}x${gridRows}) result in zero-sized cells for image (${cropW}x${cropH})`,
    );
  }

  // Compute hash for each grid cell
  const hashes: string[] = [];

  for (let row = 0; row < gridRows; row++) {
    for (let col = 0; col < gridCols; col++) {
      const cellBuffer = await sharp(croppedBuffer)
        .extract({
          left: col * cellW,
          top: row * cellH,
          width: cellW,
          height: cellH,
        })
        .toBuffer();

      const hash = await phash(cellBuffer);
      hashes.push(hash);
    }
  }

  return hashes;
}

/**
 * Compare two grid hash arrays for similarity.
 * Returns true if enough cells match.
 */
export function compareGridHashes(
  hashes1: string[],
  hashes2: string[],
  threshold = 5,
  minMatchRatio = 0.8,
): boolean {
  "use step";
  if (hashes1.length !== hashes2.length || hashes1.length === 0) {
    return false;
  }

  let matches = 0;
  for (let i = 0; i < hashes1.length; i++) {
    if (areHashesSimilar(hashes1[i], hashes2[i], threshold)) {
      matches++;
    }
  }

  return matches / hashes1.length >= minMatchRatio;
}

/**
 * Compute a single perceptual hash on the full cropped frame.
 * Used for duplicate detection across slides.
 */
export async function computeFrameHash(
  imageBuffer: Buffer,
  centerCropRatio = 0.6,
): Promise<string> {
  "use step";
  const metadata = await sharp(imageBuffer).metadata();
  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;

  if (width === 0 || height === 0) {
    throw new Error("Cannot compute hash for image with zero dimensions");
  }

  // Extract center crop
  const { left, top, cropW, cropH } = computeCenterCrop(
    width,
    height,
    centerCropRatio,
  );

  const croppedBuffer = await sharp(imageBuffer)
    .extract({ left, top, width: cropW, height: cropH })
    .toBuffer();

  return phash(croppedBuffer);
}
