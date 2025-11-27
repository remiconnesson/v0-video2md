
# AI SDK Structured Output Streaming with `streamObject`

This document provides actionable guidance for implementing structured output streaming using the AI SDK's `streamObject` function.

## Overview

`streamObject` streams a typed, structured object for a given prompt and schema using a language model. Use it when object generation takes a long time (large schemas) and you want to display the generated object incrementally as it's being created.

### When to Use `streamObject` vs `generateObject`

| Scenario | Use |
|----------|-----|
| Quick, small outputs | `generateObject` |
| Large schemas (many fields/nested objects) | `streamObject` |
| Real-time UI updates required | `streamObject` |
| Background processing (no UI) | `generateObject` |

## Quick Start

### 1. Define Your Schema

Create a schema using Zod in a **separate file** so both client and server can import it:

```typescript
// schema.ts
import { z } from "zod";

export const notificationSchema = z.object({
  notifications: z.array(
    z.object({
      name: z.string().describe("Name of a fictional person."),
      message: z.string().describe("Message content."),
    })
  ),
});

export type NotificationResult = z.infer<typeof notificationSchema>;
```

### 2. Server-Side: API Route

```typescript
// app/api/generate/route.ts
import { streamObject } from "ai";
import { notificationSchema } from "@/lib/schema";

export const maxDuration = 30;

export async function POST(req: Request) {
  const { prompt } = await req.json();

  const result = streamObject({
    model: "openai/gpt-5-mini",
    schema: notificationSchema,
    prompt,
  });

  return result.toTextStreamResponse();
}
```

### 3. Client-Side: React Hook

```tsx
"use client";

import { experimental_useObject as useObject } from "@ai-sdk/react";
import { notificationSchema } from "@/lib/schema";

export function NotificationGenerator() {
  const { object, submit, isLoading, stop, error } = useObject({
    api: "/api/generate",
    schema: notificationSchema,
  });

  return (
    <div>
      <button
        onClick={() => submit("Generate 3 notifications")}
        disabled={isLoading}
      >
        Generate
      </button>

      {isLoading && <button onClick={stop}>Stop</button>}
      {error && <div>Error: {error.message}</div>}

      {object?.notifications?.map((notification, i) => (
        <div key={i}>
          <strong>{notification?.name}</strong>: {notification?.message}
        </div>
      ))}
    </div>
  );
}
```

## `streamObject` API Reference

### Parameters

```typescript
streamObject({
  model: "openai/gpt-5-mini",       // Required: model identifier
  schema: myZodSchema,               // Required: Zod schema defining output structure
  prompt: "Your prompt here",        // User prompt
  system: "System instructions",     // Optional: system prompt
  mode: "auto",                      // Optional: 'auto' | 'json' | 'tool'
  output: "object",                  // Optional: 'object' | 'array' | 'enum' | 'no-schema'
  maxRetries: 2,                     // Optional: retry count on failure
  abortSignal: controller.signal,    // Optional: for cancellation
  onFinish: (result) => { },         // Optional: callback when complete
});
```

### Return Values

The `streamObject` function returns an object with several useful properties:

```typescript
const result = streamObject({ ... });

// Stream Helpers
result.toTextStreamResponse()      // Returns a Response for Next.js API routes
result.textStream                  // AsyncIterable<string> of raw text chunks
result.partialObjectStream         // AsyncIterable<DeepPartial<T>> of partial objects

// Promises (await these for final values)
await result.object                // Final complete object (typed)
await result.usage                 // Token usage statistics
await result.warnings              // Any warnings from the model
await result.providerMetadata      // Provider-specific metadata
```

### Consuming Streams Manually

For more control, iterate over the streams directly:

```typescript
const result = streamObject({
  model: "openai/gpt-5-mini",
  schema: mySchema,
  prompt: "Generate content",
});

// Option 1: Partial object stream (typed partial objects)
for await (const partialObject of result.partialObjectStream) {
  console.log(partialObject); // DeepPartial<T> - may have undefined fields
}

// Option 2: Text stream (raw JSON chunks)
for await (const textChunk of result.textStream) {
  console.log(textChunk);
}

// Get final object
const finalObject = await result.object;
```

## `useObject` Hook Reference

The `useObject` hook (from `@ai-sdk/react`) handles client-side streaming:

```typescript
const {
  object,      // DeepPartial<T> | undefined - current streamed value
  submit,      // (input: string | object) => void - trigger generation
  isLoading,   // boolean - streaming in progress
  stop,        // () => void - abort current stream
  error,       // Error | undefined - any error that occurred
} = useObject({
  api: "/api/endpoint",              // Required: API route URL
  schema: myZodSchema,                // Required: same schema as server
  id?: "unique-id",                  // Optional: for multiple instances
  initialValue?: { ... },             // Optional: initial object state
  onError?: (error) => { },          // Optional: error callback
  onFinish?: (result) => { },        // Optional: completion callback
});
```

## Error Handling

### Server-Side

```typescript
export async function POST(req: Request) {
  try {
    const result = streamObject({
      model: "openai/gpt-5-mini",
      schema: mySchema,
      prompt: "...",
    });
    return result.toTextStreamResponse();
  } catch (error) {
    return new Response(JSON.stringify({ error: "Generation failed" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
```

### Client-Side

```tsx
const { error, object } = useObject({
  api: "/api/generate",
  schema: mySchema,
  onError: (err) => {
    console.error("Stream error:", err);
    // Show toast, retry, etc.
  },
});

{error && <ErrorBanner message={error.message} />}
```

## Handling Partial Data

During streaming, `object` contains partial data with potentially undefined fields. Always use optional chaining:

```tsx
// ✅ Safe - handles undefined
<div>{object?.title}</div>
<div>{object?.items?.map(item => item?.name)}</div>

// ❌ Unsafe - will crash during streaming
<div>{object.title}</div>
<div>{object.items.map(item => item.name)}</div>
```

## Output Modes

### Object Mode (default)

Generates a single object matching the schema:

```typescript
streamObject({
  output: "object",
  schema: z.object({ title: z.string(), items: z.array(z.string()) }),
  // ...
});
```

### Array Mode

Generates an array of items, streamed one at a time:

```typescript
streamObject({
  output: "array",
  schema: z.object({ name: z.string(), value: z.number() }), // Schema for each item
  // ...
});
```

### Enum Mode

Generates one of several predefined values:

```typescript
streamObject({
  output: "enum",
  enum: ["positive", "negative", "neutral"],
  // ...
});
```

## Example: Converting Existing Code

### Before: Using `generateObject`

```typescript
// ai/transcript-to-book.ts
import { generateObject } from "ai";
import { transcriptToBookSchema } from "./transcript-to-book-schema";

export async function generateTranscriptToBook(input: TranscriptToBookInput) {
  const result = await generateObject({
    model: "openai/gpt-5-mini",
    schema: transcriptToBookSchema,
    system: TRANSCRIPT_TO_BOOK_SYSTEM_PROMPT,
    prompt: userPrompt,
  });
  return result.object;
}
```

### After: Using `streamObject` (Server Action)

```typescript
// ai/transcript-to-book-stream.ts
import { streamObject } from "ai";
import { transcriptToBookSchema } from "./transcript-to-book-schema";

export async function streamTranscriptToBook(input: TranscriptToBookInput) {
  return streamObject({
    model: "openai/gpt-5-mini",
    schema: transcriptToBookSchema,
    system: TRANSCRIPT_TO_BOOK_SYSTEM_PROMPT,
    prompt: buildUserPrompt(input),
  });
}
```

### After: API Route + Client

```typescript
// app/api/transcript/route.ts
import { streamObject } from "ai";
import { transcriptToBookSchema } from "@/ai/transcript-to-book-schema";

export async function POST(req: Request) {
  const input = await req.json();
  
  const result = streamObject({
    model: "openai/gpt-5-mini",
    schema: transcriptToBookSchema,
    system: TRANSCRIPT_TO_BOOK_SYSTEM_PROMPT,
    prompt: buildUserPrompt(input),
  });

  return result.toTextStreamResponse();
}
```

```tsx
// components/transcript-form.tsx
"use client";

import { experimental_useObject as useObject } from "@ai-sdk/react";
import { transcriptToBookSchema } from "@/ai/transcript-to-book-schema";

export function TranscriptForm() {
  const { object, submit, isLoading } = useObject({
    api: "/api/transcript",
    schema: transcriptToBookSchema,
  });

  return (
    <div>
      <button onClick={() => submit({ title: "...", transcript: "..." })}>
        Generate Book
      </button>

      {/* Show chapters as they stream in */}
      {object?.chapters?.map((chapter, i) => (
        <div key={i}>
          <h2>{chapter?.chapterTitle ?? "Loading..."}</h2>
          <p>{chapter?.bookChapter}</p>
        </div>
      ))}
    </div>
  );
}
```

## References

- [AI SDK Core: `streamObject` Reference](https://ai-sdk.dev/docs/reference/ai-sdk-core/stream-object)
- [Next.js Cookbook: Stream Object](https://ai-sdk.dev/cookbook/next/stream-object)
- [RSC Cookbook: Stream Object](https://ai-sdk.dev/cookbook/rsc/stream-object)
