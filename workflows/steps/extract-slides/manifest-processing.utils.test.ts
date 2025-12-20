import { describe, expect, it } from "vitest";

import type { FrameMetadata, Segment } from "@/lib/slides-types";
import {
  extractSlideTimings,
  filterStaticSegments,
  generateBlobPath,
  hasUsableFrames,
  normalizeFrameMetadata,
} from "./manifest-processing.utils";

describe("manifest-processing utils", () => {
  const baseSegment: Segment = {
    kind: "static",
    start_time: 0,
    end_time: 10,
    duration: 10,
    first_frame: undefined,
    last_frame: undefined,
    url: null,
  };

  const sampleFrame: FrameMetadata = {
    frame_id: "frame-123",
    duplicate_of: { segment_id: 2, frame_position: "last" },
    url: "https://example.com/frame-123.webp",
  };

  it("should detect usable frames", () => {
    expect(
      hasUsableFrames({ ...baseSegment, first_frame: { ...sampleFrame } }),
    ).toBe(true);
    expect(
      hasUsableFrames({ ...baseSegment, last_frame: { ...sampleFrame } }),
    ).toBe(true);
    expect(
      hasUsableFrames({
        ...baseSegment,
        first_frame: { ...sampleFrame },
        last_frame: { ...sampleFrame },
      }),
    ).toBe(true);
    expect(
      hasUsableFrames({
        ...baseSegment,
        first_frame: undefined,
        last_frame: undefined,
      }),
    ).toBe(false);
    expect(hasUsableFrames({ ...baseSegment, first_frame: undefined })).toBe(
      false,
    );
  });

  it("should normalize frame metadata and handle missing frames", () => {
    const normalized = normalizeFrameMetadata(sampleFrame, "https://image");
    expect(normalized).toEqual({
      imageUrl: "https://image",
      isDuplicate: true,
      duplicateOfSegmentId: 2,
      duplicateOfFramePosition: "last",
    });

    const nonDuplicate = normalizeFrameMetadata(
      { ...sampleFrame, duplicate_of: null },
      "https://image",
    );
    expect(nonDuplicate.isDuplicate).toBe(false);
    expect(nonDuplicate.duplicateOfSegmentId).toBeNull();
    expect(nonDuplicate.duplicateOfFramePosition).toBeNull();

    const missing = normalizeFrameMetadata(undefined, null);
    expect(missing).toEqual({
      imageUrl: null,
      isDuplicate: false,
      duplicateOfSegmentId: null,
      duplicateOfFramePosition: null,
    });
  });

  it("should build blob paths using frame IDs when available", () => {
    expect(generateBlobPath("video1", "frame-1", 0, "first")).toBe(
      "slides/video1/frame-1.webp",
    );
    expect(generateBlobPath("video1", null, 1, "last")).toBe(
      "slides/video1/1-last.webp",
    );
  });

  it("should filter static segments", () => {
    const segments = [{ ...baseSegment }, { ...baseSegment, kind: "moving" }];
    expect(filterStaticSegments(segments)).toEqual([{ ...baseSegment }]);
  });

  it("should extract slide timings", () => {
    expect(extractSlideTimings(baseSegment)).toEqual({
      startTime: 0,
      endTime: 10,
      duration: 10,
    });
  });
});
