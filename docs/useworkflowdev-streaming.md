# Workflow DevKit: Streaming Guide

This guide focuses on **streaming data through workflows** using Workflow DevKit. For general WDK concepts, see [useworkflowdev.md](./useworkflowdev.md).

Reference: https://useworkflow.dev/docs/foundations/streaming

---

## Overview

Workflows can stream data in real-time to clients without waiting for the entire workflow to complete. This enables:

- Progress updates
- AI-generated content (token by token)
- Log messages
- Incremental data delivery

---

## Core Concept: `getWritable()`

Every workflow run has a default writable stream. Steps write to it using `getWritable()`. Data written becomes immediately available to clients.

```ts
import { getWritable } from "workflow";

async function writeProgress(message: string) {
  "use step";

  const writable = getWritable<string>();
  const writer = writable.getWriter();
  await writer.write(message);
  writer.releaseLock();
}

export async function simpleStreamingWorkflow() {
  "use workflow";

  await writeProgress("Starting task...");
  await writeProgress("Processing data...");
  await writeProgress("Task complete!");
}
```

---

## Critical Rule: No Stream Operations in Workflow Context

> **Streams cannot be read from or written to directly in workflow functions.**
> All stream operations must happen in step functions.

Workflow functions must be deterministic for replay. Streams bypass the event log, so reading/writing in a workflow would break determinism.

### ❌ Bad Example

```ts
export async function badWorkflow() {
  "use workflow";

  const writable = getWritable<string>();
  const writer = writable.getWriter(); // ❌ Cannot do this
  await writer.write("data"); // ❌ Cannot do this
}
```

### ✅ Good Example

```ts
export async function goodWorkflow() {
  "use workflow";

  await writeToStream("data"); // ✅ Delegate to step
}

async function writeToStream(data: string) {
  "use step";

  const writable = getWritable<string>();
  const writer = writable.getWriter();
  await writer.write(data);
  writer.releaseLock();
}
```

---

## Consuming Streams (API Routes)

### Basic Stream Response

```ts
// app/api/stream/route.ts
import { start } from "workflow/api";
import { simpleStreamingWorkflow } from "@/workflows/simple";

export async function POST() {
  const run = await start(simpleStreamingWorkflow);

  return new Response(run.readable, {
    headers: { "Content-Type": "text/plain" },
  });
}
```

### Resuming Streams (Reconnection)

Use `run.getReadable({ startIndex })` to resume from a specific position after timeouts or network interruptions:

```ts
// app/api/resume-stream/[runId]/route.ts
import { getRun } from "workflow/api";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ runId: string }> }
) {
  const { runId } = await params;
  const { searchParams } = new URL(request.url);

  const startIndexParam = searchParams.get("startIndex");
  const startIndex = startIndexParam ? parseInt(startIndexParam, 10) : undefined;

  const run = getRun(runId);
  const stream = run.getReadable({ startIndex });

  return new Response(stream, {
    headers: { "Content-Type": "text/plain" },
  });
}
```

---

## Passing Streams as Arguments

Streams are serializable in WDK. You can pass them as workflow arguments:

### API Route

```ts
// app/api/upload/route.ts
import { start } from "workflow/api";
import { streamProcessingWorkflow } from "@/workflows/streaming";

export async function POST(request: Request) {
  // Pass request body stream directly to workflow
  const run = await start(streamProcessingWorkflow, [request.body]);
  await run.result();

  return Response.json({ status: "complete" });
}
```

### Workflow

```ts
// workflows/streaming.ts
export async function streamProcessingWorkflow(
  inputStream: ReadableStream<Uint8Array>
) {
  "use workflow";

  const result = await processInputStream(inputStream);
  return { length: result.length };
}

async function processInputStream(input: ReadableStream<Uint8Array>) {
  "use step";

  const chunks: Uint8Array[] = [];
  for await (const chunk of input) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}
```

---

## Namespaced Streams

Use `getWritable({ namespace: 'name' })` for multiple independent streams (logs, metrics, data, etc.):

### Writing to Namespaced Streams

```ts
import { getWritable } from "workflow";

type LogEntry = { level: string; message: string };
type MetricEntry = { cpu: number; memory: number };

async function writeLogs() {
  "use step";

  const logs = getWritable<LogEntry>({ namespace: "logs" });
  const writer = logs.getWriter();

  await writer.write({ level: "info", message: "Task started" });
  await writer.write({ level: "info", message: "Processing..." });

  writer.releaseLock();
}

async function writeMetrics() {
  "use step";

  const metrics = getWritable<MetricEntry>({ namespace: "metrics" });
  const writer = metrics.getWriter();

  await writer.write({ cpu: 45, memory: 512 });
  await writer.write({ cpu: 52, memory: 520 });

  writer.releaseLock();
}

async function closeStreams() {
  "use step";

  await getWritable({ namespace: "logs" }).close();
  await getWritable({ namespace: "metrics" }).close();
}

export async function multiStreamWorkflow() {
  "use workflow";

  await writeLogs();
  await writeMetrics();
  await closeStreams();
}
```

### Consuming Namespaced Streams

```ts
import { start } from "workflow/api";
import { multiStreamWorkflow } from "@/workflows/multi";

export async function GET() {
  const run = await start(multiStreamWorkflow);

  // Access specific namespace
  const logsStream = run.getReadable({ namespace: "logs" });

  return new Response(logsStream, {
    headers: { "Content-Type": "application/json" },
  });
}
```

---

## Streaming Between Steps

One step produces a stream, another consumes it:

```ts
export async function streamPipelineWorkflow() {
  "use workflow";

  const stream = await generateData();
  const results = await consumeData(stream);

  return { count: results.length };
}

async function generateData(): Promise<ReadableStream<number>> {
  "use step";

  return new ReadableStream<number>({
    start(controller) {
      for (let i = 0; i < 10; i++) {
        controller.enqueue(i);
      }
      controller.close();
    },
  });
}

async function consumeData(readable: ReadableStream<number>) {
  "use step";

  const values: number[] = [];
  for await (const value of readable) {
    values.push(value);
  }
  return values;
}
```

---

## Processing Large Files (No Memory Overhead)

Stream chunks through transformation steps without loading entire files:

```ts
export async function fileProcessingWorkflow(fileUrl: string) {
  "use workflow";

  const rawStream = await downloadFile(fileUrl);
  const processedStream = await transformData(rawStream);
  await uploadResult(processedStream);
}

async function downloadFile(url: string): Promise<ReadableStream<Uint8Array>> {
  "use step";
  const response = await fetch(url);
  return response.body!;
}

async function transformData(
  input: ReadableStream<Uint8Array>
): Promise<ReadableStream<Uint8Array>> {
  "use step";

  return input.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        // Process each chunk individually
        controller.enqueue(chunk);
      },
    })
  );
}

async function uploadResult(stream: ReadableStream<Uint8Array>) {
  "use step";
  await fetch("https://storage.example.com/upload", {
    method: "POST",
    body: stream,
  });
}
```

---

## Progress Updates Pattern

```ts
import { getWritable, sleep } from "workflow";

type ProgressUpdate = {
  step: string;
  current: number;
  total: number;
  percentage: number;
};

async function sendProgress(step: string, current: number, total: number) {
  "use step";

  const writable = getWritable<ProgressUpdate>();
  const writer = writable.getWriter();

  await writer.write({
    step,
    current,
    total,
    percentage: Math.round((current / total) * 100),
  });

  writer.releaseLock();
}

async function processItem(item: string, index: number, total: number) {
  "use step";

  const writable = getWritable<ProgressUpdate>();
  const writer = writable.getWriter();

  await writer.write({
    step: `Processing ${item}`,
    current: index,
    total,
    percentage: Math.round((index / total) * 100),
  });

  writer.releaseLock();
}

async function finalizeProgress() {
  "use step";

  const writable = getWritable<ProgressUpdate>();
  const writer = writable.getWriter();
  await writer.write({ step: "Complete", current: 100, total: 100, percentage: 100 });
  writer.releaseLock();

  await writable.close();
}

export async function progressWorkflow(items: string[]) {
  "use workflow";

  await sendProgress("Starting", 0, items.length);

  for (let i = 0; i < items.length; i++) {
    await processItem(items[i], i + 1, items.length);
    await sleep("1s");
  }

  await finalizeProgress();
}
```

---

## Streaming AI Responses

### With AI SDK (UIMessageChunk)

```ts
import { DurableAgent } from "@workflow/ai/agent";
import { getWritable } from "workflow";
import { z } from "zod";
import type { UIMessageChunk } from "ai";

async function searchFlights({ query }: { query: string }) {
  "use step";

  // Tools can emit progress updates to the stream
  const writable = getWritable<UIMessageChunk>();
  const writer = writable.getWriter();
  await writer.write({
    type: "data-progress",
    data: { message: `Searching flights for ${query}...` },
    transient: true,
  });
  writer.releaseLock();

  // ... search logic ...
  return { flights: [/* results */] };
}

export async function aiAssistantWorkflow(userMessage: string) {
  "use workflow";

  const agent = new DurableAgent({
    model: "anthropic/claude-haiku-4.5",
    system: "You are a helpful flight assistant.",
    tools: {
      searchFlights: {
        description: "Search for flights",
        inputSchema: z.object({ query: z.string() }),
        execute: searchFlights,
      },
    },
  });

  await agent.stream({
    messages: [{ role: "user", content: userMessage }],
    writable: getWritable<UIMessageChunk>(),
  });
}
```

### API Route with createUIMessageStreamResponse

```ts
// app/api/ai-assistant/route.ts
import { createUIMessageStreamResponse } from "ai";
import { start } from "workflow/api";
import { aiAssistantWorkflow } from "@/workflows/ai";

export async function POST(request: Request) {
  const { message } = await request.json();

  const run = await start(aiAssistantWorkflow, [message]);

  return createUIMessageStreamResponse({
    stream: run.readable,
  });
}
```

---

## Stream Error Handling

When a step returns a stream, the step succeeds once it returns—even if the stream later errors. The workflow won't retry the step. Consumers must handle errors:

```ts
import { FatalError } from "workflow";

async function produceStream(): Promise<ReadableStream<number>> {
  "use step";

  // Step succeeds once it returns the stream
  return new ReadableStream<number>({
    start(controller) {
      controller.enqueue(1);
      controller.enqueue(2);
      // Error occurs after step completed
      controller.error(new Error("Stream failed"));
    },
  });
}

async function consumeStream(stream: ReadableStream<number>) {
  "use step";

  try {
    for await (const value of stream) {
      console.log(value);
    }
  } catch (error) {
    // Retrying won't help—stream is already errored
    throw new FatalError("Stream failed");
  }
}

export async function streamErrorWorkflow() {
  "use workflow";

  const stream = await produceStream(); // Step succeeds
  await consumeStream(stream); // Consumer handles errors
}
```

> **Note:** Stream errors don't trigger automatic retries for the producer step. Use `FatalError` in consumers to fail immediately since retrying won't help.

---

## Best Practices

### 1. Always Release Locks

```ts
const writer = writable.getWriter();
try {
  await writer.write(data);
} finally {
  writer.releaseLock(); // Always release!
}
```

> If a lock is not released, the step process cannot terminate. Even though the step returns and the workflow continues, the underlying process remains active until timeout.

### 2. Close Streams When Done

```ts
async function finalizeStream() {
  "use step";

  await getWritable().close(); // Signal completion
}
```

Streams auto-close when the workflow completes, but explicit closing signals completion to consumers earlier.

### 3. Use Typed Streams

```ts
type MyData = { id: string; value: number };

const writable = getWritable<MyData>();
const writer = writable.getWriter();
await writer.write({ id: "abc", value: 42 }); // Type-safe
```

### 4. Handle Concurrent Writers

Stream locks acquired in a step only apply within that step. Multiple steps can write to the same stream concurrently.

---

## Stream Persistence

Streams in WDK are backed by persistent, resumable storage:

| Environment | Storage |
|-------------|---------|
| Vercel deployments | Redis-based stream |
| Local development | Filesystem |

This enables streams to maintain state across workflow suspensions.

---

## Quick Reference

```ts
// Get default writable stream
import { getWritable } from "workflow";
const writable = getWritable<T>();

// Get namespaced stream
const logs = getWritable<LogEntry>({ namespace: "logs" });

// Write to stream (in step only)
const writer = writable.getWriter();
await writer.write(data);
writer.releaseLock();

// Close stream
await writable.close();

// Get readable from run
const run = await start(workflow);
const readable = run.readable;
// or
const readable = run.getReadable();

// Resume from position
const readable = run.getReadable({ startIndex: 5 });

// Get namespaced readable
const logs = run.getReadable({ namespace: "logs" });
```

---

## Related Documentation

- [getWritable() API](https://useworkflow.dev/docs/api-reference/workflow/get-writable)
- [start() API](https://useworkflow.dev/docs/api-reference/workflow-api/start)
- [getRun() API](https://useworkflow.dev/docs/api-reference/workflow-api/get-run)
- [DurableAgent](https://useworkflow.dev/docs/api-reference/workflow-ai/durable-agent)
- [Errors and Retries](https://useworkflow.dev/docs/foundations/errors-and-retries)
- [Serialization](https://useworkflow.dev/docs/foundations/serialization)
- [Flight Booking Example](https://github.com/vercel/workflow-examples/tree/main/flight-booking-app)

