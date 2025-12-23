# video2md

Turn a YouTube video into structured Markdown: transcript, AI analysis, and slide extraction with timestamps.

**Live demo**
- `https://v0-video2md.vercel.app`

## What this app does

1. **Ingest a YouTube URL or video ID**
2. **Fetch and persist the transcript**
3. **Run AI analysis** (summary, key takeaways, actionable insights) with real-time streaming updates
4. **Extract presentation slides** from video frames and associate them with timing information
5. **Browse processed videos** in a dashboard optimized for large lists (virtualized scrolling)

## Why it exists

Long-form video is high-signal but low-reuse. This project is a practical pipeline for converting video into a searchable, portable artifact (Markdown) that can feed docs, knowledge bases, or downstream retrieval systems.

## Key features

- **YouTube ingestion**
  - Accepts full URLs or video IDs
  - Validation endpoint to keep input handling safe and predictable
- **Transcript extraction**
  - Fetches transcript and stores it for repeatable analysis
- **AI-powered analysis**
  - Uses the Vercel AI SDK + OpenAI
  - Streams progress and intermediate results via Server-Sent Events (SSE)
- **Slide extraction**
  - Extracts slide-like frames and returns them with timing metadata
- **Operational UX**
  - Processing status endpoints
  - Dashboard for browsing and re-opening prior runs
