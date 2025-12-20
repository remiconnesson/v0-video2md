# Claude Instructions for video2md

## Project Overview

video2md is a Next.js 16 application that processes YouTube videos to extract transcripts, perform AI-powered analysis, and extract presentation slides. It's a "Knowledge Base Ingestion" tool for importing YouTube video content.

## Quick Reference

### Always Run Before Committing

```bash
pnpm format      # Format code with Biome
pnpm fix         # Fix linting issues with Biome
pnpm tsc --noEmit # Type check without emitting files
```

### Development Commands

```bash
pnpm dev         # Start development server
pnpm build       # Build for production
pnpm start       # Start production server
pnpm test        # Run all tests once
pnpm test:watch  # Run tests in watch mode
```

## Key Technologies

- **Framework**: Next.js 16 with App Router
- **Language**: TypeScript (strict mode)
- **UI Library**: React 19 with Radix UI (shadcn/ui)
- **Styling**: Tailwind CSS 4
- **Database**: PostgreSQL (Neon) with Drizzle ORM
- **AI/LLM**: Vercel AI SDK with OpenAI
- **Testing**: Vitest with React Testing Library
- **Code Quality**: Biome (linting and formatting)
- **Package Manager**: pnpm

## Project Structure

```
/app          # Next.js App Router pages and API routes
/components   # React components (ui/ for shadcn, analyze/ for features)
/lib          # Shared utilities, types, and validation
/workflows    # Vercel Workflow definitions for async tasks
/db           # Drizzle ORM schema (PostgreSQL)
/ai           # AI integration (prompts, streaming analysis)
```

## Testing Philosophy

- **DO**: Write tests for code you write (business logic, utilities, components)
- **DON'T**: Write tests that just verify frameworks/libraries work
- **DON'T**: Write tests that duplicate TypeScript's type checking guarantees

## Important Guidelines

1. **Component Organization**: Extract complex inline JSX into named sub-components
2. **File Structure**: Use `@/*` path alias for imports
3. **TypeScript**: Always use strict mode, avoid `any` types
4. **API Routes**: Use Server-Sent Events for streaming responses
5. **Security**: Validate all user inputs, sanitize data before rendering
6. **Styling**: Use Tailwind CSS utility classes exclusively
7. **Database**: Use Drizzle ORM with Zod for validation

## Key Files

- `lib/youtube-utils.ts` - YouTube URL validation with SSRF protection
- `lib/sse.ts` - Server-Sent Events handler for streaming
- `lib/api-utils.ts` - API helpers and video ID validation
- `db/schema.ts` - Database schema with Drizzle ORM
- `workflows/` - Long-running async task definitions

## API Patterns

- Use `lib/api-utils.ts` for video ID validation and SSE responses
- Follow Next.js App Router conventions for API routes
- Return appropriate HTTP status codes
- Use Server-Sent Events for streaming responses (analysis, slides)

For comprehensive instructions, refer to [.github/copilot-instructions.md](.github/copilot-instructions.md).
