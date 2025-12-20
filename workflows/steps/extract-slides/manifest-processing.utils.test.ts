import { describe, expect, it } from "vitest";

import type { FrameMetadata, StaticSegment } from "@/lib/slides-types";
import {
  buildS3HttpUrl,
  extractSlideTimings,
  filterStaticSegments,
  generateBlobPath,
  hasUsableFrames,
  normalizeFrameMetadata,
  parseS3Uri,
} from "./manifest-processing.utils";

describe("manifest-processing utils", () => {
  const baseSegment: StaticSegment = {
    kind: "static",
    start_time: 0,
    end_time: 10,
    duration: 10,
    first_frame: undefined,
    last_frame: undefined,
  };

  const sampleFrame: FrameMetadata = {
    frame_id: "frame-123",
    duplicate_of: { segment_id: 2, frame_position: "last" },
    skip_reason: "duplicate",
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
        first_frame: null,
        last_frame: null,
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
      skipReason: "duplicate",
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
      skipReason: null,
    });
  });

  it("should parse valid s3 URIs and reject invalid ones", () => {
    expect(parseS3Uri("s3://bucket/key")).toEqual({
      bucket: "bucket",
      key: "key",
    });
    expect(parseS3Uri("s3://bucket/path/to/nested/key")).toEqual({
      bucket: "bucket",
      key: "path/to/nested/key",
    });
    expect(parseS3Uri("s3://bucket/key/")).toEqual({
      bucket: "bucket",
      key: "key/",
    });
    expect(parseS3Uri("")).toBeNull();
    expect(parseS3Uri("invalid://bucket/key")).toBeNull();
    expect(parseS3Uri("s3://bucket")).toBeNull();
    expect(parseS3Uri("s3://")).toBeNull();
  });

  it("should build HTTP URLs without double slashes", () => {
    expect(buildS3HttpUrl("https://example.com/", "bucket", "key")).toBe(
      "https://example.com/bucket/key",
    );
    expect(buildS3HttpUrl("https://example.com", "bucket", "key")).toBe(
      "https://example.com/bucket/key",
    );
    expect(buildS3HttpUrl("https://example.com", "", "key")).toBe(
      "https://example.com//key",
    );
    expect(buildS3HttpUrl("https://example.com", "bucket", "")).toBe(
      "https://example.com/bucket/",
    );
    expect(
      buildS3HttpUrl("https://example.com", "bucket with space", "key%20one"),
    ).toBe("https://example.com/bucket with space/key%20one");
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
