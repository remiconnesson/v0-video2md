# MEMORY.md - Streamed Transcript Analysis Design

## Problem Statement

The current transcript analysis implementation has a durability issue:
- Uses `streamObject` with `no-schema` JSON mode
- Streams partial results to the client but only saves to DB at the end
- If the workflow times out or fails, all progress is lost
- Analysis results can be large and take a long time to generate

## Current Implementation

### Schema (db/schema.ts)
- `videoAnalysisRuns`: Stores full analysis result as JSONB
  - `videoId` (PK)
  - `result` (JSONB) - stores the complete analysis object
  - `createdAt`

### Flow
1. `streamDynamicAnalysis()` in `ai/dynamic-analysis.ts` uses `streamObject` with `output: "no-schema"`
2. Streams partial objects to client via `emit()` to the workflow's writable stream
3. Only saves to DB after `await analysisStream.object` completes
4. If timeout occurs before completion, nothing is saved

## Solution: Tool-Based Section Streaming

### Approach
Instead of streaming a single large JSON object, use a tool-based approach where:
1. The LLM calls a tool (e.g., `emit_section`) for each section it generates
2. Each tool call is a durable workflow step that immediately saves to DB
3. If the workflow times out, already-emitted sections persist
4. On resume, we can continue from where we left off

### New Schema Design

```typescript
// New table for storing individual sections
export const transcriptAnalysisSections = pgTable(
  "transcript_analysis_sections",
  {
    id: serial("id").primaryKey(),
    videoId: videoIdColumn(),
    sectionKey: varchar("section_key", { length: 100 }).notNull(), // e.g., "tldr", "key_takeaways"
    sectionTitle: text("section_title"), // Human-readable title (optional)
    markdown: text("markdown").notNull(), // Section content
    sectionOrder: integer("section_order").notNull(), // Order in output
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("transcript_analysis_sections_video_idx").on(table.videoId),
    unique("transcript_analysis_sections_video_key").on(table.videoId, table.sectionKey),
  ]
);

// Track analysis completion status
export const transcriptAnalysisStatus = pgTable(
  "transcript_analysis_status",
  {
    videoId: videoIdColumn().primaryKey(),
    status: analysisStatusEnum("status").notNull().default("pending"),
    sectionCount: integer("section_count"), // Total sections expected (if known)
    completedSections: integer("completed_sections").default(0), // Sections saved so far
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    completedAt: timestamp("completed_at"),
  }
);
```

### Backward Compatibility

The existing `videoAnalysisRuns` table:
- Continues to work for reading legacy analysis data
- New analyses use `transcriptAnalysisSections` instead
- Query layer checks both: if sections exist, use them; otherwise fall back to legacy `result` JSONB

### Implementation Plan

1. **Schema changes**: Add new tables
2. **Tool definition**: Create `emit_section` tool that saves to DB
3. **AI streaming**: Switch from `streamObject` to `streamText` with tools
4. **Workflow update**: Use DurableAgent pattern with the emit_section tool
5. **Query layer**: Add functions to read sections and reconstruct analysis
6. **API compatibility**: Return same format whether legacy or new

### DurableAgent Pattern (from docs)

```typescript
import { DurableAgent } from "@workflow/ai/agent";
import { z } from "zod";

// Tool that saves section to DB (marked as step for durability)
async function emitSection({ sectionKey, sectionTitle, markdown, order }: {
  sectionKey: string;
  sectionTitle: string | null;
  markdown: string;
  order: number;
}) {
  "use step";
  // Save to DB and emit to stream
}

export async function analyzeTranscriptWorkflow(videoId: string) {
  "use workflow";

  const agent = new DurableAgent({
    model: "openai/gpt-5.1",
    system: ANALYSIS_SYSTEM_PROMPT,
    tools: {
      emit_section: {
        description: "Emit a completed analysis section",
        inputSchema: z.object({
          sectionKey: z.string(),
          sectionTitle: z.string().nullable(),
          markdown: z.string(),
          order: z.number(),
        }),
        execute: emitSection,
      },
    },
  });

  await agent.stream({
    messages: [{ role: "user", content: transcript }],
    writable: getWritable(),
  });
}
```

## References

- Workflow streaming docs: `docs/useworkflowdev-streaming.md`
- AI SDK streamObject: `docs/ai-sdk-stream-objects.md`
- Current analysis: `ai/dynamic-analysis.ts`, `workflows/steps/transcript-analysis.ts`
- Schema: `db/schema.ts`
