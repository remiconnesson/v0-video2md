# MEMORY.md - Streamed Transcript Analysis Design

## Problem Statement

The current transcript analysis implementation has a durability issue:
- Uses `streamObject` with `no-schema` JSON mode
- Streams partial results to the client but only saves to DB at the end
- If the workflow times out or fails, all progress is lost
- Analysis results can be large and take a long time to generate

## Solution: Tool-Based Section Streaming

### Approach
Instead of streaming a single large JSON object, use a tool-based approach where:
1. The LLM calls a tool (`emit_section`) for each section it generates
2. Each tool call saves the section to the database immediately
3. If the workflow times out, already-emitted sections persist
4. On resume, we can continue from where we left off

### Implementation Status: COMPLETED

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

### AI Streaming Function (`ai/streamed-section-analysis.ts`)

New module implementing tool-based streaming:
- Uses `streamText` from AI SDK with `toolChoice: "required"`
- Defines `emit_section` tool that the model calls for each section
- Each tool call immediately saves to database
- Provides `onSectionEmitted` callback for client streaming

Key features:
- Immediate persistence per section
- Callback support for real-time client updates
- System prompt optimized for tool-based output

### Workflow Steps (`workflows/steps/transcript-analysis.ts`)

Added new steps:
- `initializeStreamedAnalysis()` - clear previous data, set status to "streaming"
- `doStreamedSectionAnalysis()` - run analysis with per-section DB saves
- `finalizeStreamedAnalysis()` - mark analysis complete
- `failStreamedAnalysis()` - handle errors

Added new event type:
```typescript
export type SectionAnalysisStreamEvent =
  | { type: "progress"; phase: string; message: string }
  | { type: "section"; data: SectionEmitArgs }
  | { type: "complete" }
  | { type: "error"; message: string };
```

### New Workflow (`workflows/analyze-transcript-streamed.ts`)

New workflow `analyzeTranscriptStreamedWorkflow` that:
1. Gets or fetches transcript (same as before)
2. Initializes streamed analysis (clears old data)
3. Runs streamed section analysis (saves each section immediately)
4. Finalizes or fails analysis based on outcome

## Backward Compatibility

The existing `videoAnalysisRuns` table:
- Continues to work for reading legacy analysis data
- New analyses use `transcriptAnalysisSections` instead
- Query layer can check both: if sections exist, use them; otherwise fall back to legacy

## How It Works

1. **Model generates sections**: The LLM is prompted to call `emit_section` for each analysis section
2. **Tool executes**: Each tool call triggers the `execute` function
3. **Immediate save**: The execute function saves the section to `transcriptAnalysisSections`
4. **Counter increment**: `completedSections` in status table is incremented
5. **Client notification**: The `onSectionEmitted` callback streams to the client
6. **Durability**: If workflow times out after N sections, those N sections persist

## TODO (Future Work)

1. **API Route**: Create API route that uses the new workflow
2. **Migration**: Run database migration to create new tables
3. **UI Update**: Update frontend to handle section-by-section streaming
4. **Query Unification**: Add function to return analysis in same format regardless of source
5. **DurableAgent**: When `@workflow/ai` package is available, migrate to DurableAgent for even better durability

## Note on DurableAgent

The original plan was to use `DurableAgent` from `@workflow/ai/agent` package. However, this package isn't currently installed/available. The current implementation uses AI SDK's `streamText` with tools directly, which provides per-tool-call durability but not per-step durability within a single workflow step.

For full durability (where each tool call is a separate durable step), we would need DurableAgent. The current approach still provides significant improvement over the original implementation since sections are saved immediately upon tool call completion.

## References

- Workflow streaming docs: `docs/useworkflowdev-streaming.md`
- AI SDK tools: `docs/ai-sdk-stream-objects.md`
- Original analysis: `ai/dynamic-analysis.ts`
- New analysis: `ai/streamed-section-analysis.ts`
- Workflow steps: `workflows/steps/transcript-analysis.ts`
- New workflow: `workflows/analyze-transcript-streamed.ts`
- Schema: `db/schema.ts`
- Queries: `db/queries.ts`
