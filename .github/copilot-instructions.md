# Copilot Instructions for video2md

## Project Overview

video2md is a Next.js application that processes YouTube videos and extracts meaningful information (transcripts, slides, analysis). The project uses modern web technologies and follows strict code quality standards.

## Technology Stack

- **Framework**: Next.js 16 with App Router
- **UI Library**: React 19
- **Language**: TypeScript (strict mode enabled)
- **Styling**: Tailwind CSS 4
- **State Management**: React hooks and server components
- **Database**: Neon (PostgreSQL) with Drizzle ORM
- **AI/Streaming**: Vercel AI SDK, Effect, workflow library
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

- **DO**: Write tests for code you write (business logic, utilities, components)
- **DON'T**: Write tests that just verify frameworks/libraries work
- **DON'T**: Write tests that duplicate TypeScript's type checking guarantees

### Running Tests

```bash
pnpm test        # Run all tests once
pnpm test:watch  # Run tests in watch mode
```

## Component Organization

### Component Structure

- Extract complex inline JSX into named sub-components
- Use clear section separators with comments (e.g., `// ============ Section Name`)
- Keep components focused and single-purpose
- Examples: `components/analyze/analyze-view.tsx`, `components/processed-videos-list.tsx`

### File Organization

- **`/app`**: Next.js App Router pages and API routes
- **`/components`**: React components (UI and feature components)
- **`/lib`**: Shared utilities and types
- **`/hooks`**: Custom React hooks
- **`/db`**: Database schema and migrations
- **`/styles`**: Global styles
- **`/public`**: Static assets

## API Patterns

### API Utilities

Use `lib/api-utils.ts` for shared API utilities:
- Video ID validation
- SSE (Server-Sent Events) response creation
- Workflow stream resumption

### API Routes

- Follow Next.js App Router conventions
- Use proper error handling
- Return appropriate HTTP status codes
- Use Server-Sent Events for streaming responses

## TypeScript Guidelines

- Always use strict TypeScript mode
- Define proper types for all data structures
- Use type utilities from `lib/type-utils.ts`
- Avoid `any` types
- Use Zod for runtime validation when needed

## Styling Guidelines

- Use Tailwind CSS utility classes
- Follow existing patterns in the codebase
- Use `@/*` path alias for imports
- Leverage component libraries: Radix UI components in `components/ui/`

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

## Security Considerations

- Validate all user inputs
- Sanitize data before rendering
- Use environment variables for secrets
- Follow OWASP best practices
- Use proper CORS configuration
