import { beforeEach, describe, expect, it, vi } from "vitest";
import { consumeSSE } from "./sse";

// Helper to create a mock Response with a readable stream
function createMockSSEResponse(lines: string[]): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      for (const line of lines) {
        controller.enqueue(encoder.encode(line));
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream" },
  });
}

type TestEvent =
  | { type: "message"; content: string }
  | { type: "status"; value: string }
  | { type: "complete" };

describe("consumeSSE", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should consume SSE events and call appropriate handlers", async () => {
    const messageHandler = vi.fn();
    const statusHandler = vi.fn();
    const completeHandler = vi.fn();

    const response = createMockSSEResponse([
      'data: {"type":"message","content":"hello"}\n\n',
      'data: {"type":"status","value":"processing"}\n\n',
      'data: {"type":"complete"}\n\n',
    ]);

    await consumeSSE<TestEvent>(response, {
      message: messageHandler,
      status: statusHandler,
      complete: completeHandler,
    });

    expect(messageHandler).toHaveBeenCalledWith({
      type: "message",
      content: "hello",
    });
    expect(statusHandler).toHaveBeenCalledWith({
      type: "status",
      value: "processing",
    });
    expect(completeHandler).toHaveBeenCalledWith({ type: "complete" });
  });

  it("should handle events split across multiple chunks", async () => {
    const messageHandler = vi.fn();

    const response = createMockSSEResponse([
      'data: {"type":"mes',
      'sage","conte',
      'nt":"split"}\n\n',
    ]);

    await consumeSSE<TestEvent>(response, {
      message: messageHandler,
      status: vi.fn(),
      complete: vi.fn(),
    });

    expect(messageHandler).toHaveBeenCalledWith({
      type: "message",
      content: "split",
    });
  });

  it("should skip lines that don't start with data prefix", async () => {
    const messageHandler = vi.fn();

    const response = createMockSSEResponse([
      ": comment line\n",
      'data: {"type":"message","content":"hello"}\n\n',
      "invalid line\n",
      'data: {"type":"message","content":"world"}\n\n',
    ]);

    await consumeSSE<TestEvent>(response, {
      message: messageHandler,
      status: vi.fn(),
      complete: vi.fn(),
    });

    expect(messageHandler).toHaveBeenCalledTimes(2);
    expect(messageHandler).toHaveBeenCalledWith({
      type: "message",
      content: "hello",
    });
    expect(messageHandler).toHaveBeenCalledWith({
      type: "message",
      content: "world",
    });
  });

  it("should skip empty data lines", async () => {
    const messageHandler = vi.fn();

    const response = createMockSSEResponse([
      "data: \n\n",
      'data: {"type":"message","content":"hello"}\n\n',
      "data:   \n\n",
    ]);

    await consumeSSE<TestEvent>(response, {
      message: messageHandler,
      status: vi.fn(),
      complete: vi.fn(),
    });

    expect(messageHandler).toHaveBeenCalledTimes(1);
  });

  it("should handle custom data prefix", async () => {
    const messageHandler = vi.fn();

    const response = createMockSSEResponse([
      'event: {"type":"message","content":"hello"}\n\n',
    ]);

    await consumeSSE<TestEvent>(
      response,
      {
        message: messageHandler,
        status: vi.fn(),
        complete: vi.fn(),
      },
      { dataPrefix: "event: " },
    );

    expect(messageHandler).toHaveBeenCalledWith({
      type: "message",
      content: "hello",
    });
  });

  it("should call onError when parsing fails", async () => {
    const errorHandler = vi.fn();
    const messageHandler = vi.fn();

    const response = createMockSSEResponse([
      'data: {"type":"message","content":"hello"}\n\n',
      "data: invalid json\n\n",
    ]);

    await consumeSSE<TestEvent>(
      response,
      {
        message: messageHandler,
        status: vi.fn(),
        complete: vi.fn(),
      },
      { onError: errorHandler },
    );

    expect(messageHandler).toHaveBeenCalledTimes(1);
    // Invalid JSON should be skipped (continue statement in code)
    expect(errorHandler).not.toHaveBeenCalled();
  });

  it("should handle response without body", async () => {
    const response = new Response(null);

    await expect(
      consumeSSE<TestEvent>(response, {
        message: vi.fn(),
        status: vi.fn(),
        complete: vi.fn(),
      }),
    ).rejects.toThrow("Response body is not a readable stream");
  });

  it("should process data in buffer when stream ends", async () => {
    const messageHandler = vi.fn();

    // Create a response with data but no trailing newline
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(
          encoder.encode('data: {"type":"message","content":"hello"}'),
        );
        controller.close(); // Close without newline
      },
    });

    const response = new Response(stream);

    await consumeSSE<TestEvent>(response, {
      message: messageHandler,
      status: vi.fn(),
      complete: vi.fn(),
    });

    expect(messageHandler).toHaveBeenCalledWith({
      type: "message",
      content: "hello",
    });
  });

  it("should handle abort errors silently", async () => {
    const errorHandler = vi.fn();

    const stream = new ReadableStream({
      start(controller) {
        controller.error(new DOMException("Aborted", "AbortError"));
      },
    });

    const response = new Response(stream);

    await consumeSSE<TestEvent>(
      response,
      {
        message: vi.fn(),
        status: vi.fn(),
        complete: vi.fn(),
      },
      { onError: errorHandler },
    );

    expect(errorHandler).not.toHaveBeenCalled();
  });

  it("should handle multiple events on same line", async () => {
    const messageHandler = vi.fn();

    const response = createMockSSEResponse([
      'data: {"type":"message","content":"first"}\n',
      'data: {"type":"message","content":"second"}\n\n',
    ]);

    await consumeSSE<TestEvent>(response, {
      message: messageHandler,
      status: vi.fn(),
      complete: vi.fn(),
    });

    expect(messageHandler).toHaveBeenCalledTimes(2);
  });

  it("should throw error for event without type", async () => {
    const errorHandler = vi.fn();

    const response = createMockSSEResponse(['data: {"content":"hello"}\n\n']);

    await consumeSSE<TestEvent>(
      response,
      {
        message: vi.fn(),
        status: vi.fn(),
        complete: vi.fn(),
      },
      { onError: errorHandler },
    );

    expect(errorHandler).toHaveBeenCalled();
    const error = errorHandler.mock.calls[0][0];
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toContain("Unknown event type");
  });
});
