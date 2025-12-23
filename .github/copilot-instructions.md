# Copilot Instructions for video2md

## Important Setup Instructions

1. **Package Manager**: We use `pnpm`!!! Always start new sessions with `pnpm install`.
2. **Type Generation**: Run `pnpm next typegen` to generate types before type-checking.
3. **Code Quality**: Always run `pnpm format`, `pnpm fix`, and `pnpm tsc --noEmit` before completing your work.
4. **Migrations**: DO NOT generate or attempt database migrations - the user will handle this.
5. **Final Verification**: Run `pnpm build` only at the end to verify the build passes (it's slow).

## Project Overview

video2md is a Next.js application that processes YouTube videos to extract transcripts, perform AI-powered analysis, and extract presentation slides. It serves as a "Knowledge Base Ingestion" tool for importing content from YouTube videos into structured, searchable formats.

## Technology Stack

- **Framework**: Next.js 16 with App Router
- **UI Library**: React 19
- **Language**: TypeScript (strict mode enabled)
- **Styling**: Tailwind CSS 4
- **State Management**: React hooks and server components
- **Database**: PostgreSQL (Neon) with Drizzle ORM
- **AI/LLM**: Vercel AI SDK with OpenAI
- **Workflows**: Vercel Workflow API
- **Testing**: Vitest with React Testing Library
- **Code Quality**: Biome (linting and formatting)
- **Package Manager**: pnpm

## Code Quality Standards

### Always Run Before Committing

```bash
pnpm format      # Format code with Biome
pnpm fix         # Fix linting issues with Biome
pnpm tsc --noEmit # Type check without emitting files
```

### Formatting Rules

- Indentation: 2 spaces
- Biome is configured with recommended rules for Next.js and React
- Organize imports automatically
- Use Biome configuration in `biome.json`

## Testing Guidelines

### Testing Philosophy

- **DO**: Write tests for business logic, utilities, and components we wrote in this codebase
- **DON'T**: Write tests that just verify frameworks/libraries work
- **DON'T**: Write tests that duplicate TypeScript's type checking guarantees
- **DON'T**: Use `any` in test files

**Testing Focus**: We care about testing important parts of the logic, not full coverage. Our goal with tests is confidence that things work. We use all tools available: unit tests, component tests, e2e tests (not yet set up), and type-level guarantees.

### Running Tests

```bash
pnpm test        # Run all tests once
pnpm test:watch  # Run tests in watch mode
```

## Component Organization

### Component Structure

- Extract complex inline JSX into named sub-components
- Keep components focused and single-purpose
- Examples: `components/analyze/analyze-view.tsx`, `components/processed-videos-list.tsx`

### File Organization

- **`/app`**: Next.js App Router pages and API routes
  - **`/api`**: API endpoints (video, youtube, slides)
  - **`/youtube`**: YouTube URL input page
  - **`/video/youtube/[id]`**: Dynamic video analysis pages
- **`/components`**: React components (UI and feature components)
  - **`/ui`**: Radix UI wrapped components (shadcn/ui)
  - **`/analyze`**: Analysis and slides panels
- **`/lib`**: Shared utilities and types
  - `youtube-utils.ts`: YouTube URL validation & SSRF protection
  - `api-utils.ts`: API helpers and SSE utilities
  - `sse.ts`: Server-Sent Events handler
  - `api-types.ts`: API response schemas (Zod)
  - `type-utils.ts`: TypeScript utility types
- **`/hooks`**: Custom React hooks
- **`/workflows`**: Vercel Workflow definitions
  - **`/steps`**: Workflow step implementations
- **`/db`**: Drizzle ORM schema and migrations (PostgreSQL)
- **`/ai`**: AI integration (prompts, analysis)
- **`/styles`**: Global styles
- **`/public`**: Static assets

## API Patterns

### Key Features

1. **YouTube Content Ingestion**: Accept YouTube URLs or video IDs with SSRF-protected validation and hostname allowlist
2. **Transcript Processing**: Fetch transcripts via Apify integration, store normalized data in PostgreSQL
3. **AI-Powered Analysis**: Stream-based analysis using OpenAI via Vercel AI SDK with real-time SSE
4. **Slide Extraction**: Automated slide detection from video frames with deduplication

### API Routes

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/video/[videoId]` | GET | Check video processing status |
| `/api/video/[videoId]/analysis` | GET | Fetch or start transcript analysis (SSE) |
| `/api/video/[videoId]/slides` | GET | Get slide extraction status |
| `/api/video/[videoId]/slides` | POST | Trigger slide extraction (SSE) |
| `/api/youtube/validate` | GET | Validate YouTube URL/video ID |
| `/api/videos` | GET | List all processed videos |

### API Utilities

Use `lib/api-utils.ts` for shared API utilities:
- Video ID validation
- SSE (Server-Sent Events) response creation
- Workflow stream resumption

### API Route Patterns

- Follow Next.js App Router conventions
- Use proper error handling
- Return appropriate HTTP status codes
- Use Server-Sent Events for streaming responses
- **Route Context Types**: Use the `RouteContext` helper for all route parameters instead of inline types. The `RouteContext` helper is globally available after type generation and provides strongly typed params from route literals.

```typescript
// ✅ Correct - Use RouteContext helper
export async function GET(
  request: Request,
  ctx: RouteContext<'/api/video/[videoId]'>,
) {
  const { videoId } = await ctx.params;
}

// ❌ Avoid - Inline type annotations
export async function GET(
  request: Request,
  { params }: { params: Promise<{ videoId: string }> },
) {
  const { videoId } = await params;
}
```

## TypeScript Guidelines

- Always use strict TypeScript mode
- Define proper types for all data structures
- Use type utilities from `lib/type-utils.ts`
- Avoid `any` types
- Use Zod for runtime validation when needed

## Styling Guidelines

- Use Tailwind CSS utility classes exclusively
- Follow existing patterns in the codebase
- Use `@/*` path alias for imports
- Leverage component libraries: Radix UI components in `components/ui/`

## Code Style Philosophy

We are aiming for simplicity and readability:

- **KISS** (Keep It Simple, Stupid)
- **Single Responsibility Principle**
- **Dependency Injection** (but don't overdo it)
- **Avoid Hasty Abstractions**
- **Good Variable Naming**: Prefer descriptive names over abbreviations (use 'response' instead of 'res', 'minutes' instead of 'mins', specific names like 'videoData' or 'slidesData' instead of generic 'data')
- **Code is First Written to be Read**: Code is written primarily for humans to read, and incidentally for machines to execute
- **Type-Level Guarantees**: If it can be guaranteed at the type level, we do it

### Component Extraction for Readability ("Dumb Components")

This codebase prioritizes narrative readability over reuse-driven minimalism. JSX blocks may be extracted into private (i.e., not exported), single-use "dumb" components when doing so clarifies the structure of a page or keeps the core logic easy to scan. 

Extraction is used as an editorial tool to surface the important parts of a component and push low-signal UI scaffolding out of the way. **Reuse is not required**. 

However, extracted components must remain simple:
- Minimal props
- No side effects
- No non-trivial logic

When a component accumulates real behavior or becomes reused, it should be promoted to a proper, exported component or refactored accordingly.

## Dependencies

- Use `pnpm` for package management
- Pin dependencies with `latest` for most packages
- Keep dependencies up to date
- Check `package.json` for existing libraries before adding new ones

## Environment Setup

To set up the development environment:

1. Install pnpm: `npm install -g pnpm`
2. Install dependencies: `pnpm install`
3. Set up environment variables (if needed, see `.env.example` if present)
4. Run the development server: `pnpm dev`

## Development Workflow

1. Run `pnpm dev` to start the development server
2. Make changes following the guidelines above
3. Run linting and formatting: `pnpm format && pnpm fix`
4. Run type checking: `pnpm tsc --noEmit`
5. Run tests: `pnpm test`
6. Build: `pnpm build`

## Best Practices

- Follow React 19 best practices (server components, use transitions)
- Use Effect library patterns for complex workflows
- Implement proper error boundaries
- Use proper loading and error states
- Follow Next.js App Router patterns (server components by default)
- Use client components (`'use client'`) only when necessary
- Leverage server actions for mutations when appropriate

## Common Patterns

### Streaming Responses

The project heavily uses streaming for AI responses and workflow execution. See:
- `lib/sse.ts` for SSE utilities
- `app/workflows/` for workflow examples
- API routes with streaming responses

### Video Processing

- Video ID validation and extraction from YouTube URLs
- Transcript fetching and processing
- Slide extraction and analysis
- See `lib/youtube-utils.ts` for utilities

## Database Schema

Key tables in PostgreSQL:

- **`channels`**: YouTube channel metadata
- **`videos`**: Video metadata (title, URL, published date)
- **`scrap_transcript_v1`**: Transcript data with metadata
- **`videoAnalysisRuns`**: Cached AI analysis results
- **`superAnalysisRuns`**: Unified AI analysis reports (markdown)
- **`superAnalysisWorkflowIds`**: Workflow IDs for super analysis
- **`videoSlideExtractions`**: Slide extraction jobs
- **`videoSlides`**: Extracted slide data with timing

## Security Considerations

- **SSRF Protection**: IP blocklist (private ranges), protocol validation, hostname allowlist
- **Input Validation**: YouTube video ID format validation (11 chars alphanumeric) - see `lib/youtube-utils.ts`
- **URL Resolution**: Manual redirect handling with max 5 redirects
- **Data Validation**: Zod schemas for all API responses
- Validate all user inputs
- Sanitize data before rendering
- Use environment variables for secrets
- Follow OWASP best practices
- Use proper CORS configuration
