import { describe, expect, it } from "vitest";

import type { FrameMetadata, Segment } from "@/lib/slides-types";
import {
  extractSlideTimings,
  filterStaticSegments,
  normalizeIsDuplicate,
} from "./manifest-processing.utils";

describe("manifest-processing utils", () => {
  const baseSegment: Segment = {
    kind: "static",
    start_time: 0,
    end_time: 10,
    duration: 10,
    first_frame: {
      frame_id: "frame-123",
      duplicate_of: { segment_id: 2, frame_position: "last" },
      url: "https://example.com/frame-123.webp",
    },
    last_frame: {
      frame_id: "frame-123",
      duplicate_of: { segment_id: 2, frame_position: "last" },
      url: "https://example.com/frame-123.webp",
    },
  };

  const sampleFrame: FrameMetadata = {
    frame_id: "frame-123",
    duplicate_of: { segment_id: 2, frame_position: "last" },
    url: "https://example.com/frame-123.webp",
  };

  it("should normalize frame metadata and handle missing frames", () => {
    const normalized = normalizeFrameMetadata(sampleFrame, "https://image");
    expect(normalized).toEqual({
      imageUrl: "https://image",
      isDuplicate: true,
      duplicateOfSlideNumber: 2,
      duplicateOfFramePosition: "last",
    });

    const nonDuplicate = normalizeFrameMetadata({
      ...sampleFrame,
      duplicate_of: null,
    });
    expect(nonDuplicate.isDuplicate).toBe(false);
    expect(nonDuplicate.duplicateOfSlideNumber).toBeNull();
    expect(nonDuplicate.duplicateOfFramePosition).toBeNull();

    const missing = normalizeFrameMetadata(undefined);
    expect(missing).toEqual({
      isDuplicate: false,
      duplicateOfSlideNumber: null,
      duplicateOfFramePosition: null,
    });
  });

  it("should filter static segments", () => {
    const segments: Segment[] = [
      { ...baseSegment },
      { ...baseSegment, kind: "moving" },
    ];
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
