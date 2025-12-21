# video2md

A Next.js application that processes YouTube videos to extract transcripts, perform AI-powered analysis, and extract presentation slides. Transform video content into structured, searchable knowledge.

## Features

- **YouTube Content Ingestion** - Accept YouTube URLs or video IDs with secure validation
- **Transcript Extraction** - Automatically fetch and store video transcripts
- **AI-Powered Analysis** - Generate summaries, key takeaways, and actionable insights using LLMs
- **Slide Extraction** - Extract presentation slides from video frames with timing information
- **Real-time Streaming** - Live updates via Server-Sent Events during processing
- **Video Dashboard** - Browse and search processed videos with virtualized scrolling

## Tech Stack

| Category | Technology |
|----------|-----------|
| Framework | Next.js 16 with App Router |
| UI Library | React 19 with Radix UI (shadcn/ui) |
| Language | TypeScript (strict mode) |
| Styling | Tailwind CSS 4 |
| Database | PostgreSQL (Neon) with Drizzle ORM |
| AI/LLM | Vercel AI SDK with OpenAI |
| Testing | Vitest with React Testing Library |
| Code Quality | Biome (linting and formatting) |

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm
- PostgreSQL database (or Neon account)

### Installation

1. Clone the repository:
   \`\`\`bash
   git clone https://github.com/remiconnesson/v0-video2md.git
   cd v0-video2md
   \`\`\`

2. Install dependencies:
   \`\`\`bash
   pnpm install
   \`\`\`

3. Set up environment variables:
   \`\`\`bash
   cp .env.example .env
   # Edit .env with your database URL and API keys
   \`\`\`

4. Run database migrations:
   \`\`\`bash
   pnpm drizzle-kit push
   \`\`\`

5. Start the development server:
   \`\`\`bash
   pnpm dev
   \`\`\`

Visit [http://localhost:3000](http://localhost:3000) to see the application.

## Development

### Commands

\`\`\`bash
pnpm dev         # Start development server
pnpm build       # Build for production
pnpm start       # Start production server
pnpm test        # Run all tests
pnpm test:watch  # Run tests in watch mode
pnpm format      # Format code with Biome
pnpm fix         # Fix linting issues
pnpm tsc --noEmit # Type check
\`\`\`

### Project Structure

\`\`\`
/app              # Next.js App Router pages and API routes
  /api            # API endpoints for video processing
  /youtube        # YouTube URL input page
  /video          # Video analysis pages
/components       # React components
  /ui             # Radix UI components (shadcn/ui)
  /analyze        # Analysis and slides panels
/lib              # Shared utilities and types
/workflows        # Vercel Workflow definitions
/db               # Drizzle ORM schema
/ai               # AI integration and prompts
\`\`\`

### API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/youtube/validate` | GET | Validate YouTube URL/video ID |
| `/api/video/[videoId]` | GET | Get video processing status |
| `/api/video/[videoId]/analysis` | GET | Stream AI analysis (SSE) |
| `/api/video/[videoId]/slides` | GET/POST | Get or trigger slide extraction |
| `/api/videos` | GET | List all processed videos |

## Contributing

1. Ensure code passes quality checks before committing:
   \`\`\`bash
   pnpm format && pnpm fix && pnpm tsc --noEmit
   \`\`\`

2. Run tests:
   \`\`\`bash
   pnpm test
   \`\`\`

3. Follow the coding guidelines in [.github/copilot-instructions.md](.github/copilot-instructions.md)
