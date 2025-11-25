# Workflow DevKit Guide for Next.js 16 + Vercel

This guide covers building LLM workflows with **Workflow DevKit** (useworkflow.dev) in Next.js 16 deployed on Vercel.

---

## What is Workflow DevKit?

Workflow DevKit (WDK) provides **durable, resumable workflows** in TypeScript/JavaScript with:

- **Workflow functions** – deterministic orchestration logic (`"use workflow"`)
- **Step functions** – real-world side effects (`"use step"`)
- Built-in scheduling, retries, hooks, webhooks, and observability
- Automatic integration with Vercel's infrastructure

---

## Setup in Next.js 16

### 1. Install the package

```bash
npm i workflow
# or: pnpm add workflow
```

### 2. Configure Next.js

```ts
// next.config.ts
import { withWorkflow } from "workflow/next";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // your config
};

export default withWorkflow(nextConfig);
```

### 3. (Optional) TypeScript IntelliSense

```json
// tsconfig.json
{
  "compilerOptions": {
    "plugins": [{ "name": "workflow" }]
  }
}
```

---

## Core Concepts

### Workflows vs Steps

| Aspect | Workflow (`"use workflow"`) | Step (`"use step"`) |
|--------|----------------------------|---------------------|
| Role | Orchestration / conductor | Side-effectful work |
| Environment | Sandboxed, deterministic | Full Node.js access |
| State | Durable, resumable | Stateless |
| Retries | N/A | Automatic on failure |

### Determinism Rules

Inside `"use workflow"` functions:
- ❌ No Node core modules (`fs`, `http`, `crypto`, `child_process`)
- ❌ No global `fetch` (use `import { fetch } from "workflow"`)
- ✅ All data must be serializable (primitives, arrays, plain objects, Date, Map, Set)
- ❌ No functions, class instances, or symbols passed between workflow/steps

### Serialization Pattern for Classes

```ts
class User {
  constructor(public name: string) {}
  greet() { return `Hello ${this.name}`; }
}

export async function greetWorkflow() {
  "use workflow";
  await greetStep({ name: "Alice" }); // pass plain data
}

async function greetStep(data: { name: string }) {
  "use step";
  const user = new User(data.name);
  console.log(user.greet());
}
```

---

## Building LLM Workflows

### Basic Workflow + Steps

```ts
// workflows/user-signup.ts
import { sleep, FatalError } from "workflow";

export async function handleUserSignup(email: string) {
  "use workflow";
  const user = await createUser(email);
  await sendWelcomeEmail(user);
  await sleep("5s"); // durable sleep – no resources used
  await sendOnboardingEmail(user);
  return { userId: user.id, status: "onboarded" };
}

async function createUser(email: string) {
  "use step";
  return { id: crypto.randomUUID(), email };
}

async function sendWelcomeEmail(user: { id: string; email: string }) {
  "use step";
  if (Math.random() < 0.3) {
    throw new Error("Retryable!"); // auto-retried
  }
  console.log(`Welcome email sent to ${user.id}`);
}

async function sendOnboardingEmail(user: { id: string; email: string }) {
  "use step";
  if (!user.email.includes("@")) {
    throw new FatalError("Invalid Email"); // NOT retried
  }
  console.log(`Onboarding email sent to ${user.id}`);
}
```

### LLM Content Generation Example

```ts
// workflows/ai-content.ts
import { fetch } from "workflow";
import { FatalError } from "workflow";

export async function aiContentWorkflow(topic: string) {
  "use workflow";
  const draft = await generateDraft(topic);
  const summary = await summarizeDraft(draft);
  return { draft, summary };
}

async function generateDraft(topic: string) {
  "use step";
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4o",
      messages: [{ role: "user", content: `Write about: ${topic}` }],
    }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error("LLM API error: " + data.error?.message);
  return data.choices[0].message.content;
}

async function summarizeDraft(draftText: string) {
  "use step";
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4o",
      messages: [{ role: "user", content: `Summarize: ${draftText}` }],
    }),
  });
  const data = await response.json();
  if (!response.ok) throw new FatalError("Failed to summarize");
  return data.choices[0].message.content;
}
```

---

## Using fetch with AI SDK

The AI SDK uses `fetch` internally. Override `globalThis.fetch` with workflow's fetch:

```ts
import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";
import { fetch } from "workflow";

export async function aiWorkflow(userMessage: string) {
  "use workflow";
  globalThis.fetch = fetch; // Required!
  
  const result = await generateText({
    model: openai("gpt-4o"),
    prompt: userMessage,
  });
  return result.text;
}
```

---

## API Routes

### Starting a Workflow (Fire-and-Forget)

```ts
// app/api/signup/route.ts
import { NextResponse } from "next/server";
import { start } from "workflow/api";
import { handleUserSignup } from "@/workflows/user-signup";

export async function POST(req: Request) {
  const { email } = await req.json();
  await start(handleUserSignup, [email]);
  return NextResponse.json({ message: "Workflow started" });
}
```

### Starting with Run ID (for tracking)

```ts
import { start } from "workflow/api";

export async function POST(req: Request) {
  const { topic } = await req.json();
  const run = await start(aiContentWorkflow, [topic]);
  return NextResponse.json({ 
    message: "Workflow started", 
    runId: run.runId 
  });
}
```

---

## Streaming Responses

### Writing to Stream (Server)

```ts
import { getWritable } from "workflow";

async function streamLLMResponse(prompt: string) {
  "use step";
  const writable = getWritable<string>();
  const writer = writable.getWriter();

  const response = await fetch("<LLM endpoint>", { /* streaming */ });
  const reader = response.body!.getReader();

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    const chunk = new TextDecoder().decode(value);
    await writer.write(chunk);
  }
  writer.releaseLock();
}
```

### Returning Stream from API Route

```ts
// app/api/chat/route.ts
import { start } from "workflow/api";
import { chatWorkflow } from "@/workflows/chat";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const { messages } = await request.json();
  const run = await start(chatWorkflow, [messages]);
  const stream = run.getReadable();

  return new NextResponse(stream, {
    headers: {
      "Content-Type": "text/plain",
      "x-workflow-run-id": run.runId, // Required for resumption
    },
  });
}
```

### Stream Reconnection Route

```ts
// app/api/chat/[runId]/stream/route.ts
import { getRun } from "workflow/api";
import { NextResponse } from "next/server";

export async function GET(
  request: Request,
  { params }: { params: { runId: string } }
) {
  const { runId } = params;
  const url = new URL(request.url);
  const startIndex = url.searchParams.get("startIndex");

  const run = getRun(runId);
  const stream = run.getReadable({
    startIndex: startIndex ? parseInt(startIndex, 10) : undefined,
  });

  return new NextResponse(stream, {
    headers: { "Content-Type": "text/plain" },
  });
}
```

---

## Front-End: WorkflowChatTransport

Use `WorkflowChatTransport` with the AI SDK's `useChat` hook for reliable streaming.

### Basic Usage

```tsx
"use client";
import { useChat } from "@ai-sdk/react";
import { WorkflowChatTransport } from "@workflow/ai";

export default function Chat() {
  const { messages, sendMessage } = useChat({
    transport: new WorkflowChatTransport(),
  });

  return (
    <div>
      {messages.map((m) => (
        <div key={m.id}>
          <strong>{m.role}:</strong> {m.content}
        </div>
      ))}
    </div>
  );
}
```

### With Session Resumption

```tsx
"use client";
import { useChat } from "@ai-sdk/react";
import { WorkflowChatTransport } from "@workflow/ai";
import { useMemo } from "react";

export default function ChatWithResumption() {
  const activeWorkflowRunId = useMemo(() => {
    if (typeof window === "undefined") return undefined;
    return localStorage.getItem("active-workflow-run-id") ?? undefined;
  }, []);

  const { messages, sendMessage } = useChat({
    transport: new WorkflowChatTransport({
      onChatSendMessage: (response, options) => {
        localStorage.setItem("chat-history", JSON.stringify(options.messages));
        const runId = response.headers.get("x-workflow-run-id");
        if (runId) localStorage.setItem("active-workflow-run-id", runId);
      },
      onChatEnd: () => {
        localStorage.removeItem("active-workflow-run-id");
      },
    }),
    resume: !!activeWorkflowRunId,
  });

  // ... UI
}
```

**WorkflowChatTransport provides:**
- Automatic reconnection on network issues
- Stream resumption via `x-workflow-run-id` header
- Hooks for persistence (`onChatSendMessage`, `onChatEnd`)

---

## Hooks & Webhooks

### Hooks (for external events)

```ts
import { createHook } from "workflow";

export async function approvalWorkflow() {
  "use workflow";
  const hook = createHook<{ approved: boolean; comment: string }>();
  console.log("Approval token:", hook.token);
  
  const result = await hook; // suspends until resumed
  
  if (result.approved) {
    console.log("Approved:", result.comment);
  }
}
```

### Webhooks (HTTP-based)

```ts
import { createWebhook } from "workflow";

export async function webhookWorkflow() {
  "use workflow";
  const webhook = createWebhook();
  console.log("Webhook URL:", webhook.url);
  
  const request = await webhook; // suspends until HTTP request
  const body = await request.text();
  console.log("Received:", body);
}
```

---

## Deployment on Vercel

**Automatic:** WDK uses Vercel World in production automatically. No extra config needed.

- **Local dev:** Uses Local World (filesystem at `.workflow-data/`)
- **Vercel:** Uses Vercel World (managed storage/queues)

---

## Observability (CLI)

```bash
# List recent runs
npx workflow inspect runs

# Web UI
npx workflow inspect runs --web

# Inspect Vercel backend
npx workflow inspect runs --backend vercel
```

---

## Common Errors

| Error | Cause | Fix |
|-------|-------|-----|
| `fetch-in-workflow` | Using `fetch()` directly in workflow | `import { fetch } from "workflow"` and use it (or set `globalThis.fetch = fetch`) |
| `node-js-module-in-workflow` | Node modules in workflow | Move logic to a `"use step"` function |
| `serialization-failed` | Non-serializable data between workflow/steps | Pass plain objects; reconstruct classes in steps |

---

## Quick Reference

```ts
// Workflow function
export async function myWorkflow(arg: string) {
  "use workflow";
  // orchestration only
}

// Step function  
async function myStep(data: PlainObject) {
  "use step";
  // side effects, DB, network, etc.
}

// Durable sleep
import { sleep } from "workflow";
await sleep("5s");

// Fatal (non-retryable) error
import { FatalError } from "workflow";
throw new FatalError("Don't retry this");

// Start workflow from API
import { start } from "workflow/api";
const run = await start(myWorkflow, [arg]);

// Get stream
const stream = run.getReadable();

// Resume existing run
import { getRun } from "workflow/api";
const existingRun = getRun(runId);

// Write to stream
import { getWritable } from "workflow";
const writable = getWritable<string>();

// Workflow-safe fetch
import { fetch } from "workflow";
```

---

## Resources

- Documentation: https://useworkflow.dev
- Examples: https://github.com/vercel/workflow-examples
- Vercel Blog: https://vercel.com/blog/introducing-workflow-devkit

