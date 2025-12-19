/**
 * Video analysis for detecting static segments.
 * Ported from Python: src/slides_extractor/extract_slides/video_analyzer.py
 */

import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { TEMP_DIR } from "./config";
import {
  compareGridHashes,
  computeFrameHash,
  computeGridHashes,
} from "./frame-hasher";

// Analysis configuration
export interface AnalysisConfig {
  gridCols: number;
  gridRows: number;
  cellHashThreshold: number;
  minStaticCellRatio: number;
  minStaticFrames: number;
  fps: number;
  maxWidth: number;
}

export const DEFAULT_CONFIG: AnalysisConfig = {
  gridCols: 4,
  gridRows: 4,
  cellHashThreshold: 5,
  minStaticCellRatio: 0.8,
  minStaticFrames: 3,
  fps: 1,
  maxWidth: 1280,
};

// Frame data structure
export interface FrameData {
  index: number;
  timestamp: number;
  imagePath: string;
  imageBuffer?: Buffer;
  hashes?: string[];
  frameHash?: string; // Full-frame phash for duplicate detection
}

// Segment structure
export interface DetectedSegment {
  type: "static" | "moving";
  startTime: number;
  endTime: number;
  frames: number[];
  representativeFramePath?: string;
  representativeFrameBuffer?: Buffer;
  representativeFrameHash?: string; // Full-frame phash for duplicate detection
  lastFramePath?: string;
  lastFrameBuffer?: Buffer;
  lastFrameHash?: string; // Full-frame phash for duplicate detection
}

// Analysis result
export interface AnalysisResult {
  segments: DetectedSegment[];
  totalFrames: number;
  videoDuration: number;
}

/**
 * Extract frames from video using ffmpeg.
 * Returns paths to extracted frame images.
 */
export async function extractFrames(
  videoPath: string,
  outputDir: string,
  fps = 1,
  maxWidth = 1280,
): Promise<string[]> {
  "use step";
  // Ensure output directory exists
  await fs.mkdir(outputDir, { recursive: true });

  const outputPattern = path.join(outputDir, "frame_%05d.png");

  return new Promise((resolve, reject) => {
    const args = [
      "-i",
      videoPath,
      "-vf",
      `fps=${fps},scale='min(${maxWidth},iw)':-1`,
      "-frame_pts",
      "1",
      "-y",
      outputPattern,
    ];

    const ffmpeg = spawn("ffmpeg", args);

    let stderr = "";
    ffmpeg.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    ffmpeg.on("close", async (code) => {
      if (code !== 0) {
        reject(new Error(`ffmpeg exited with code ${code}: ${stderr}`));
        return;
      }

      // List extracted frames
      const files = await fs.readdir(outputDir);
      const frames = files
        .filter((f) => f.startsWith("frame_") && f.endsWith(".png"))
        .sort()
        .map((f) => path.join(outputDir, f));

      resolve(frames);
    });

    ffmpeg.on("error", (err) => {
      reject(new Error(`Failed to start ffmpeg: ${err.message}`));
    });
  });
}

/**
 * Get video duration using ffprobe.
 */
export async function getVideoDuration(videoPath: string): Promise<number> {
  "use step";
  return new Promise((resolve, reject) => {
    const args = [
      "-v",
      "error",
      "-show_entries",
      "format=duration",
      "-of",
      "default=noprint_wrappers=1:nokey=1",
      videoPath,
    ];

    const ffprobe = spawn("ffprobe", args);

    let stdout = "";
    let stderr = "";

    ffprobe.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    ffprobe.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    ffprobe.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`ffprobe exited with code ${code}: ${stderr}`));
        return;
      }

      const duration = Number.parseFloat(stdout.trim());
      if (Number.isNaN(duration)) {
        reject(new Error(`Invalid duration from ffprobe: ${stdout}`));
        return;
      }

      resolve(duration);
    });

    ffprobe.on("error", (err) => {
      reject(new Error(`Failed to start ffprobe: ${err.message}`));
    });
  });
}

/**
 * Segment detector state machine.
 * Ported from Python: SegmentDetector class
 */
export class SegmentDetector {
  private config: AnalysisConfig;
  private segments: DetectedSegment[] = [];
  private currentSegment: DetectedSegment | null = null;
  private anchorHashes: string[] | null = null;
  private tentativeStatic: FrameData[] = [];
  private tentativeStartHashes: string[] | null = null;

  constructor(config: Partial<AnalysisConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Process a single frame through the state machine.
   */
  async processFrame(frame: FrameData): Promise<void> {
    // Compute hashes if not already done
    if (!frame.hashes) {
      const buffer = frame.imageBuffer || (await fs.readFile(frame.imagePath));
      frame.hashes = await computeGridHashes(
        buffer,
        this.config.gridCols,
        this.config.gridRows,
      );
    }

    if (this.currentSegment === null) {
      this.startNewSegment("static", frame);
      return;
    }

    const isSimilar = this.anchorHashes
      ? compareGridHashes(
          this.anchorHashes,
          frame.hashes,
          this.config.cellHashThreshold,
          this.config.minStaticCellRatio,
        )
      : false;

    if (this.currentSegment.type === "static") {
      this.handleStaticState(frame, isSimilar);
    } else {
      this.handleMovingState(frame);
    }
  }

  private handleStaticState(frame: FrameData, isSimilar: boolean): void {
    if (isSimilar) {
      if (!this.currentSegment) {
        throw new Error("Current segment is null");
      }
      this.currentSegment.frames.push(frame.index);
      this.currentSegment.endTime = frame.timestamp;
      this.currentSegment.lastFramePath = frame.imagePath;
      this.currentSegment.lastFrameBuffer = frame.imageBuffer;
    } else {
      // Transition: Static -> Moving
      this.commitCurrentSegment();
      this.startNewSegment("moving", frame);

      // Initialize tentative buffer
      this.tentativeStatic = [frame];
      if (!frame.hashes) {
        throw new Error("Frame hashes are null");
      }
      this.tentativeStartHashes = frame.hashes;
    }
  }

  private handleMovingState(frame: FrameData): void {
    if (this.tentativeStartHashes) {
      if (!frame.hashes) {
        throw new Error("Frame hashes are null");
      }
      const isTentativeMatch = compareGridHashes(
        this.tentativeStartHashes,
        frame.hashes,
        this.config.cellHashThreshold,
        this.config.minStaticCellRatio,
      );

      if (isTentativeMatch) {
        if (!this.currentSegment) {
          throw new Error("Current segment is null");
        }
        this.tentativeStatic.push(frame);

        // Confirm new static segment if buffer is long enough
        if (this.tentativeStatic.length >= this.config.minStaticFrames) {
          // Remove tentative frames from current moving segment
          const frameIdsToRemove = new Set(
            this.tentativeStatic.map((f) => f.index),
          );
          this.currentSegment.frames = this.currentSegment.frames.filter(
            (f) => !frameIdsToRemove.has(f),
          );
          this.currentSegment.endTime = this.tentativeStatic[0].timestamp;

          // Save the moving segment
          this.commitCurrentSegment();

          // Start the new static segment
          const first = this.tentativeStatic[0];
          this.startNewSegment("static", first);

          for (let i = 1; i < this.tentativeStatic.length; i++) {
            const bufFrame = this.tentativeStatic[i];
            this.currentSegment.frames.push(bufFrame.index);
            this.currentSegment.endTime = bufFrame.timestamp;
            this.currentSegment.lastFramePath = bufFrame.imagePath;
            this.currentSegment.lastFrameBuffer = bufFrame.imageBuffer;
          }

          // Clear buffer
          this.tentativeStatic = [];
          this.tentativeStartHashes = null;
          return;
        }
      } else {
        // Noise - reset tentative buffer
        this.tentativeStatic = [frame];
        if (!frame.hashes) {
          throw new Error("Frame hashes are null");
        }
        this.tentativeStartHashes = frame.hashes;
      }
    }
    if (!this.currentSegment) {
      throw new Error("Current segment is null");
    }

    // Add to current moving segment
    this.currentSegment.frames.push(frame.index);
    this.currentSegment.endTime = frame.timestamp;
  }

  private startNewSegment(type: "static" | "moving", frame: FrameData): void {
    this.currentSegment = {
      type,
      startTime: frame.timestamp,
      endTime: frame.timestamp,
      frames: [frame.index],
    };

    if (type === "static") {
      this.currentSegment.representativeFramePath = frame.imagePath;
      this.currentSegment.representativeFrameBuffer = frame.imageBuffer;
      this.currentSegment.lastFramePath = frame.imagePath;
      this.currentSegment.lastFrameBuffer = frame.imageBuffer;
      if (!frame.hashes) {
        throw new Error("Frame hashes are null");
      }
      this.anchorHashes = frame.hashes;
    } else {
      this.anchorHashes = null;
    }
  }

  private commitCurrentSegment(): void {
    if (!this.currentSegment || this.currentSegment.frames.length === 0) {
      return;
    }

    // Merge with previous segment if same type
    const lastSegment = this.segments[this.segments.length - 1];
    if (lastSegment && lastSegment.type === this.currentSegment.type) {
      lastSegment.frames.push(...this.currentSegment.frames);
      lastSegment.endTime = this.currentSegment.endTime;
      if (this.currentSegment.type === "static") {
        lastSegment.lastFramePath = this.currentSegment.lastFramePath;
        lastSegment.lastFrameBuffer = this.currentSegment.lastFrameBuffer;
      }
    } else {
      this.segments.push(this.currentSegment);
    }
  }

  /**
   * Finalize analysis and return segments.
   */
  finalize(): DetectedSegment[] {
    this.commitCurrentSegment();
    return this.segments;
  }

  /**
   * Get current segments (for progress reporting).
   */
  getSegments(): DetectedSegment[] {
    return this.segments;
  }
}

/**
 * Analyze a video to detect static segments.
 * Main entry point for video analysis.
 */
export async function analyzeVideo(
  videoPath: string,
  config: Partial<AnalysisConfig> = {},
): Promise<AnalysisResult> {
  "use step";
  const fullConfig = { ...DEFAULT_CONFIG, ...config };

  // Create temp directory for frames
  const frameDir = path.join(TEMP_DIR, `frames_${Date.now()}`);

  try {
    // Get video duration
    const duration = await getVideoDuration(videoPath);

    // Extract frames
    const framePaths = await extractFrames(
      videoPath,
      frameDir,
      fullConfig.fps,
      fullConfig.maxWidth,
    );

    const totalFrames = framePaths.length;
    if (totalFrames === 0) {
      return {
        segments: [],
        totalFrames: 0,
        videoDuration: duration,
      };
    }

    // Initialize detector
    const detector = new SegmentDetector(fullConfig);

    // Process each frame
    for (let i = 0; i < framePaths.length; i++) {
      const framePath = framePaths[i];
      const timestamp = i / fullConfig.fps;

      const frame: FrameData = {
        index: i,
        timestamp,
        imagePath: framePath,
        imageBuffer: await fs.readFile(framePath),
      };

      await detector.processFrame(frame);
    }

    const segments = detector.finalize();

    // Compute full-frame phashes for static segments
    for (const segment of segments) {
      if (segment.type === "static") {
        if (segment.representativeFrameBuffer) {
          segment.representativeFrameHash = await computeFrameHash(
            segment.representativeFrameBuffer,
          );
        }
        if (
          segment.lastFrameBuffer &&
          segment.lastFrameBuffer !== segment.representativeFrameBuffer
        ) {
          segment.lastFrameHash = await computeFrameHash(
            segment.lastFrameBuffer,
          );
        } else if (segment.representativeFrameHash) {
          // If last frame is the same as representative, use the same hash
          segment.lastFrameHash = segment.representativeFrameHash;
        }
      }
    }

    return {
      segments,
      totalFrames,
      videoDuration: duration,
    };
  } finally {
    // Cleanup frame directory
    try {
      await fs.rm(frameDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  }
}

/**
 * Get static segments only.
 */
export function getStaticSegments(
  segments: DetectedSegment[],
): DetectedSegment[] {
  return segments.filter(
    (s) => s.type === "static" && s.representativeFramePath,
  );
}
