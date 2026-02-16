# MEMORY.md - Streamed Transcript Analysis with DurableAgent

## Problem Statement

The current transcript analysis implementation has a durability issue:
- Uses `streamObject` with `no-schema` JSON mode
- Streams partial results to the client but only saves to DB at the end
- If the workflow times out or fails, all progress is lost
- Analysis results can be large and take a long time to generate

## Solution: DurableAgent with Tool-Based Section Streaming

### Approach
Use Workflow DevKit's `DurableAgent` from `@workflow/ai/agent` with a tool-based approach where:
1. The LLM calls an `emit_section` tool for each section it generates
2. Each tool's execute function is marked with `"use step"` for durability
3. Each tool call becomes a separate durable workflow step that immediately saves to DB
4. If the workflow times out, already-completed tool calls persist
5. On resume, the workflow continues from where it left off

### Implementation Status: COMPLETED ✅

## Dependencies Added

```json
{
  "@workflow/ai": "4.0.1-beta.52",
  "workflow": "4.1.0-beta.51"
}
```

## Files Changed

### Database Schema (`db/schema.ts`)

Added two new tables:

```typescript
// Stores individual analysis sections for durability
export const transcriptAnalysisSections = pgTable(
  "transcript_analysis_sections",
  {
    id: serial("id").primaryKey(),
    videoId: videoIdColumn(),
    sectionKey: varchar("section_key", { length: 100 }).notNull(),
    sectionTitle: text("section_title"),
    markdown: text("markdown").notNull(),
    sectionOrder: integer("section_order").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("transcript_analysis_sections_video_idx").on(table.videoId),
    unique("transcript_analysis_sections_video_key").on(table.videoId, table.sectionKey),
  ]
);

// Tracks analysis completion status
export const transcriptAnalysisStatus = pgTable("transcript_analysis_status", {
  videoId: videoIdColumn().primaryKey(),
  status: analysisStatusEnum("status").notNull().default("pending"),
  completedSections: integer("completed_sections").default(0).notNull(),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
});
```

### Database Queries (`db/queries.ts`)

Added query functions:
- `saveAnalysisSection()` - upsert individual sections
- `getAnalysisSections()` - retrieve all sections for a video
- `hasAnalysisSections()` - check if video uses new format
- `deleteAnalysisSections()` - clear sections for re-analysis
- `getAnalysisStatus()` / `upsertAnalysisStatus()` - status management
- `incrementCompletedSections()` - increment section counter
- `markAnalysisCompleted()` / `markAnalysisFailed()` - finalize status

### AI Module (`ai/streamed-section-analysis.ts`)

Implements DurableAgent-based analysis:

```typescript
import { DurableAgent } from "@workflow/ai/agent";

// Durable step that saves sections (each tool call is a durable step)
export async function emitSectionStep(videoId: string, args: EmitSectionInput) {
  "use step";  // Makes this a durable workflow step!

  await saveAnalysisSection(videoId, args);
  await incrementCompletedSections(videoId);
  return { success: true, sectionKey: args.sectionKey };
}

// Creates the DurableAgent with the emit_section tool
export function createSectionAnalysisAgent(videoId: string) {
  return new DurableAgent({
    model: "openai/gpt-5.1",
    system: STREAMED_ANALYSIS_SYSTEM_PROMPT,
    toolChoice: "required",
    tools: {
      emit_section: {
        description: "Emit a completed analysis section",
        inputSchema: emitSectionSchema,
        execute: (args) => emitSectionStep(videoId, args),
      },
    },
  });
}
```

### Workflow Steps (`workflows/steps/transcript-analysis.ts`)

Simplified steps (DurableAgent handles the heavy lifting):
- `initializeStreamedAnalysis()` - clear previous data, set status to "streaming"
- `finalizeStreamedAnalysis()` - mark analysis complete
- `failStreamedAnalysis()` - handle errors

### Workflow (`workflows/analyze-transcript-streamed.ts`)

Uses DurableAgent for analysis:

```typescript
export async function analyzeTranscriptStreamedWorkflow(videoId: string) {
  "use workflow";

  const writable = getWritable<UIMessageChunk>();

  // ... fetch transcript ...

  await initializeStreamedAnalysis(videoId);

  // Create and run the DurableAgent
  const agent = createSectionAnalysisAgent(videoId);
  await agent.stream({
    messages: [{ role: "user", content: userMessage }],
    writable,
  });

  await finalizeStreamedAnalysis(videoId);
}
```

## How DurableAgent Provides Durability

1. **Tool execute functions marked with `"use step"`**: Each tool call becomes a durable workflow step
2. **Automatic retries**: Failed steps are retried up to 3 times by default
3. **State persistence**: The workflow state is persisted between steps
4. **Resumability**: If the workflow times out or crashes, it can resume from the last completed step
5. **Observability**: Each step appears in the workflow dashboard

## Backward Compatibility

The existing `videoAnalysisRuns` table:
- Continues to work for reading legacy analysis data
- New analyses use `transcriptAnalysisSections` instead
- Query layer can check both: if sections exist, use them; otherwise fall back to legacy

## TODO (Future Work)

1. **API Route**: Create API route that uses the new workflow
2. **Migration**: Run database migration to create new tables
3. **UI Update**: Update frontend to handle UIMessageChunk streaming
4. **Query Unification**: Add function to return analysis in same format regardless of source

## References

- DurableAgent docs: `@workflow/ai/agent`
- Workflow streaming docs: `docs/useworkflowdev-streaming.md`
- Original analysis: `ai/dynamic-analysis.ts`
- New analysis: `ai/streamed-section-analysis.ts`
- Workflow steps: `workflows/steps/transcript-analysis.ts`
- New workflow: `workflows/analyze-transcript-streamed.ts`
- Schema: `db/schema.ts`
- Queries: `db/queries.ts`
