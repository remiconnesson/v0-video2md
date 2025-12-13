import { describe, expect, it } from "vitest";
import {
  createSSETransformStream,
  SSE_HEADERS,
  validateYouTubeVideoId,
} from "./api-utils";
import { isValidYouTubeVideoId } from "./youtube-utils";

describe("isValidYouTubeVideoId", () => {
  it("should return true for valid video IDs", () => {
    expect(isValidYouTubeVideoId("dQw4w9WgXcQ")).toBe(true);
    expect(isValidYouTubeVideoId("a1b2c3d4e5f")).toBe(true);
    expect(isValidYouTubeVideoId("ABC-_123456")).toBe(true);
  });

  it("should return false for IDs that are too short", () => {
    expect(isValidYouTubeVideoId("short")).toBe(false);
    expect(isValidYouTubeVideoId("12345")).toBe(false);
  });

  it("should return false for IDs that are too long", () => {
    expect(isValidYouTubeVideoId("toolongvideoid123456")).toBe(false);
  });

  it("should return false for IDs with invalid characters", () => {
    expect(isValidYouTubeVideoId("invalid@id!")).toBe(false);
    expect(isValidYouTubeVideoId("has spaces ")).toBe(false);
    expect(isValidYouTubeVideoId("has.dot.in")).toBe(false);
  });

  it("should return false for empty string", () => {
    expect(isValidYouTubeVideoId("")).toBe(false);
  });
});

describe("validateYouTubeVideoId", () => {
  it("should return null for valid video ID", () => {
    const result = validateYouTubeVideoId("dQw4w9WgXcQ");
    expect(result).toBeNull();
  });

  it("should return error response for invalid video ID", () => {
    const result = validateYouTubeVideoId("invalid");
    expect(result).not.toBeNull();
    expect(result?.status).toBe(400);
  });

  it("should return error response for empty video ID", () => {
    const result = validateYouTubeVideoId("");
    expect(result).not.toBeNull();
    expect(result?.status).toBe(400);
  });

  it("should return error response for video ID with invalid characters", () => {
    const result = validateYouTubeVideoId("invalid@id!");
    expect(result).not.toBeNull();
    expect(result?.status).toBe(400);
  });
});

describe("SSE_HEADERS", () => {
  it("should have correct SSE headers", () => {
    expect(SSE_HEADERS["Content-Type"]).toBe("text/event-stream");
    expect(SSE_HEADERS["Cache-Control"]).toBe("no-cache");
    expect(SSE_HEADERS.Connection).toBe("keep-alive");
  });
});

describe("createSSETransformStream", () => {
  it("should transform chunks to SSE format", async () => {
    const stream = createSSETransformStream<{ type: string; data: string }>();
    const writer = stream.writable.getWriter();
    const reader = stream.readable.getReader();

    // Write a chunk and close writer
    const writePromise = (async () => {
      await writer.write({ type: "test", data: "hello" });
      await writer.close();
    })();

    // Read the transformed chunk
    const { value, done } = await reader.read();
    await writePromise;

    expect(done).toBe(false);
    expect(value).toBe('data: {"type":"test","data":"hello"}\n\n');

    // Check stream is done
    const { done: done2 } = await reader.read();
    expect(done2).toBe(true);
  });

  it("should handle multiple chunks", async () => {
    const stream = createSSETransformStream<{ id: number }>();
    const writer = stream.writable.getWriter();
    const reader = stream.readable.getReader();

    // Write multiple chunks asynchronously
    const writePromise = (async () => {
      await writer.write({ id: 1 });
      await writer.write({ id: 2 });
      await writer.write({ id: 3 });
      await writer.close();
    })();

    // Read all chunks
    const chunks: string[] = [];
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      chunks.push(value);
    }

    await writePromise;

    expect(chunks).toEqual([
      'data: {"id":1}\n\n',
      'data: {"id":2}\n\n',
      'data: {"id":3}\n\n',
    ]);
  });

  it("should serialize complex objects", async () => {
    const stream = createSSETransformStream<{
      nested: { value: number };
      array: string[];
    }>();
    const writer = stream.writable.getWriter();
    const reader = stream.readable.getReader();

    const writePromise = (async () => {
      await writer.write({
        nested: { value: 42 },
        array: ["a", "b", "c"],
      });
      await writer.close();
    })();

    const { value } = await reader.read();
    await writePromise;

    expect(value).toBe(
      'data: {"nested":{"value":42},"array":["a","b","c"]}\n\n',
    );
  });
});
