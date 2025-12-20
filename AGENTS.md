# Agent Instructions for video2md

## Important

1. We use `pnpm`!!! Please start all new sessions by running `pnpm install`.
2. Use `pnpm format`, `pnpm fix` and `pnpm tsc --noEmit` before saying your code is done.


## Project Overview

video2md is a Next.js 16 application that processes YouTube videos to extract transcripts, perform AI-powered analysis, and extract presentation slides. It serves as a "Knowledge Base Ingestion" tool for importing content from YouTube videos into structured, searchable formats.

## Technology Stack

| Category | Technology |
|----------|-----------|
| Framework | Next.js 16 with App Router |
| UI Library | React 19 |
| Language | TypeScript (strict mode) |
| Styling | Tailwind CSS 4 |
| Database | PostgreSQL (Neon) with Drizzle ORM |
| AI/LLM | Vercel AI SDK with OpenAI |
| Workflows | Vercel Workflow API |
| Testing | Vitest with React Testing Library |
| Code Quality | Biome (linting and formatting) |
| Package Manager | pnpm |

## Project Structure

```
/app                    # Next.js App Router pages and API routes
  /api                  # API endpoints (video, youtube, slides)
  /youtube              # YouTube URL input page
  /video/youtube/[id]   # Dynamic video analysis pages
/components             # React components
  /ui                   # Radix UI wrapped components (shadcn/ui)
  /analyze              # Analysis and slides panels
/lib                    # Shared utilities and types
  youtube-utils.ts      # YouTube URL validation & SSRF protection
  api-utils.ts          # API helpers and SSE utilities
  sse.ts                # Server-Sent Events handler
  api-types.ts          # API response schemas (Zod)
/workflows              # Vercel Workflow definitions
  /steps                # Workflow step implementations
/db                     # Drizzle ORM schema (PostgreSQL)
/ai                     # AI integration (prompts, analysis)
```

## Always Run Before Committing

```bash
pnpm format      # Format code with Biome
pnpm fix         # Fix linting issues with Biome
pnpm tsc --noEmit # Type check without emitting files
```

## Development Commands

```bash
pnpm dev         # Start development server
pnpm build       # Build for production
pnpm start       # Start production server
pnpm test        # Run all tests once
pnpm test:watch  # Run tests in watch mode
```

## Testing Philosophy

- **DO**: Write tests for business logic, utilities, and components we wrote in this codebase
- **DON'T**: Write tests that just verify frameworks/libraries work
- **DON'T**: Write tests that duplicate TypeScript's type checking guarantees
- **DON'T**: Use `any` in test files

## Key Features

### 1. YouTube Content Ingestion
- Accept YouTube URLs or video IDs
- SSRF-protected URL validation with hostname allowlist
- Video existence verification using oEmbed API

### 2. Transcript Processing
- Fetch transcripts via Apify integration
- Store normalized transcript data in PostgreSQL
- Track channel, video, and transcript metadata

### 3. AI-Powered Analysis
- Stream-based analysis using OpenAI via Vercel AI SDK
- Dynamic section generation (TLDR, key takeaways, insights)
- Real-time streaming via Server-Sent Events (SSE)

### 4. Slide Extraction
- Automated slide detection from video frames
- Frame deduplication and timing information
- External storage via Vercel Blob

## API Routes

| Endpoint | Purpose |
|----------|---------|
| `GET /api/video/[videoId]` | Check video processing status |
| `GET /api/video/[videoId]/analysis` | Fetch or start transcript analysis (SSE) |
| `GET /api/video/[videoId]/slides` | Get slide extraction status |
| `POST /api/video/[videoId]/slides` | Trigger slide extraction (SSE) |
| `GET /api/youtube/validate` | Validate YouTube URL/video ID |
| `GET /api/videos` | List all processed videos |

## Code Guidelines

1. **Component Organization**: Extract complex inline JSX into named sub-components
2. **File Structure**: Use `@/*` path alias for imports
3. **TypeScript**: Always use strict mode, avoid `any` types
4. **API Routes**: Use Server-Sent Events for streaming responses
5. **Security**: Validate all user inputs, sanitize data before rendering
6. **Styling**: Use Tailwind CSS utility classes exclusively

## Database Schema

Key tables in PostgreSQL:
- `channels` - YouTube channel metadata
- `videos` - Video metadata (title, URL, published date)
- `scrap_transcript_v1` - Transcript data with metadata
- `videoAnalysisRuns` - Cached AI analysis results
- `videoSlideExtractions` - Slide extraction jobs
- `videoSlides` - Extracted slide data with timing

## Security Considerations

- **SSRF Protection**: IP blocklist (private ranges), protocol validation, hostname allowlist
- **Input Validation**: YouTube video ID format validation (11 chars alphanumeric)
- **URL Resolution**: Manual redirect handling with max 5 redirects
- **Data Validation**: Zod schemas for all API responses

## Detailed Instructions

For comprehensive instructions including API patterns, styling guidelines, and best practices, refer to [.github/copilot-instructions.md](.github/copilot-instructions.md).
