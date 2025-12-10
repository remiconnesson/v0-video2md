# video2md

A Next.js 16 application that ingests YouTube videos into a searchable knowledge base by streaming transcripts, slide decks, and AI-driven analysis into a Postgres database. The project prioritizes fast feedback with Server-Sent Events (SSE), resilient workflows, and a modern React 19 UI built with Tailwind CSS and Radix primitives.

[![Deployed on Vercel](https://img.shields.io/badge/Deployed%20on-Vercel-black?style=for-the-badge&logo=vercel)](https://vercel.com/remiconnessons-projects/v0-video2md)
[![Built with v0](https://img.shields.io/badge/Built%20with-v0.app-black?style=for-the-badge)](https://v0.app/chat/WDNaYAAY4qX)

## Features
- **YouTube ingestion:** Accepts a YouTube video ID, validates the format, fetches the transcript through Apify, and stores normalized channel/video/transcript metadata in Postgres via Drizzle ORM.
- **Streaming UX:** Long-running work (transcript fetch, slide extraction, analysis) streams progress and results over SSE so the UI never blocks.
- **AI analysis:** Workflow-based processors generate structured analyses, slide text, and summaries that are versioned per video for later review and feedback.
- **Repeatable workflows:** All ingestion and analysis tasks run as resumable workflows, enabling stream reconnection and safe retries.
- **Typed utilities & tests:** Shared helpers for API validation, time parsing, SSE serialization, YouTube utilities, and analysis formatting are covered by unit tests.

## Architecture Overview
- **Frontend:** React 19 with the App Router. Pages live in `app/` and rely on shadcn/Radix UI components plus Tailwind 4 for styling. Home (`/`) links to the dedicated YouTube flow (`/youtube`).
- **Workflows:** The `app/workflows` directory defines streaming workflows (e.g., `fetch-transcript`, `fetch-and-analyze`, `extract-slides`, `dynamic-analysis`) that emit progress, completion, and error events. The `steps` subfolder holds granular operations for reuse.
- **APIs:** App Router API routes under `app/api` expose ingestion endpoints, validate YouTube IDs, and translate workflow streams into SSE responses using helpers from `lib/api-utils.ts`.
- **Database:** Drizzle schema in `db/schema.ts` models channels, videos, transcript records, analysis runs, and feedback tables. Connections use the Neon serverless driver configured via `DATABASE_URL`.
- **AI & scraping:** Transcript ingestion depends on Apify (`APIFY_API_TOKEN`), and slide extraction can target a private S3 endpoint with signed AWS requests (`SLIDES_EXTRACTOR_URL`, `S3_*`).

## Directory Structure
- `app/` – Next.js routes, global styles, and workflow definitions.
  - `page.tsx` – Home CTA linking to YouTube mode with recent processed videos.
  - `youtube/page.tsx` – Main ingestion form and explainer.
  - `api/` – API handlers that start/resume workflows and return SSE streams.
  - `workflows/` – Workflow entrypoints plus reusable `steps/` (Apify fetch, slide extraction, analysis pipelines).
- `components/` – UI building blocks: YouTube transcript form, processed video list, analysis views, and shadcn-styled primitives under `ui/`.
- `db/` – Drizzle schema, Neon client, and helpers for saving transcripts with validation.
- `lib/` – Cross-cutting utilities (API validation, SSE helpers, YouTube parsing, transcript formatting, analysis formatting, time utilities) with matching unit tests.
- `docs/` – Supplemental project documentation.
- `styles/` – Global Tailwind layer configuration.

## Data Flow: YouTube Transcript Ingestion
1. **User input:** A YouTube video ID is submitted from `/youtube`. `lib/api-utils.ts` enforces the 11-character ID pattern before work begins.
2. **Workflow start:** The `fetch-transcript` workflow checks for cached transcripts in Postgres; if absent, it calls Apify using `APIFY_API_TOKEN`.
3. **Normalization & persistence:** Responses are transformed into channel/video/transcript records and upserted through Drizzle models in `db/schema.ts`.
4. **Streaming feedback:** Progress updates, completion payloads, or errors are emitted over SSE so the client can render live status.
5. **Follow-on analysis:** Additional workflows (e.g., `fetch-and-analyze`, `dynamic-analysis`) can enrich the stored transcript with AI-generated outlines, slide content, and summaries.

## Development Setup
1. **Prerequisites:** Node.js ≥ 18 and pnpm installed globally (`npm install -g pnpm`).
2. **Install dependencies:**
   ```bash
   pnpm install
   ```
3. **Environment variables:** Create a `.env` file with at least:
   - `DATABASE_URL` – Postgres connection string (Neon recommended).
   - `APIFY_API_TOKEN` – Token for transcript scraping.
   - `SLIDES_EXTRACTOR_URL`, `S3_BASE_URL`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `SLIDES_API_PASSWORD`, `BLOB_READ_WRITE_TOKEN` – Required when running slide extraction workflows.
4. **Run the dev server:**
   ```bash
   pnpm dev
   ```
   The app starts on `http://localhost:3000`.

## Quality Gates
Before committing, run the project’s required checks:
```bash
pnpm format      # Format with Biome
pnpm fix         # Auto-fix lint issues with Biome
pnpm tsc --noEmit # Strict type checking
```

## Testing
Execute the Vitest suite (configured with React Testing Library and happy-dom):
```bash
pnpm test
```
Additional scripts: `pnpm test:watch` for watch mode and `pnpm test-transcript` to exercise transcript fetching utilities.

## Database & Migrations
- The Drizzle schema lives in `db/schema.ts`; configuration is in `drizzle.config.ts` (reads `DATABASE_URL`).
- Generate migrations with `drizzle-kit` if schema changes are introduced, then run them against your database before starting the app.

## Deployment
- The project is configured for Vercel. Build with `pnpm build` and start with `pnpm start` in production environments.
- Streaming endpoints rely on SSE-friendly hosting; ensure your platform supports streaming responses.

## Troubleshooting & Tips
- Invalid YouTube IDs return a 400 immediately; use only 11-character IDs.
- Missing environment variables throw explicit errors at startup for easier debugging.
- Workflows are resumable: reconnect clients using the workflow run ID and `resumeWorkflowStream` helpers if streams drop.

## Useful Links
- Live deployment: https://vercel.com/remiconnessons-projects/v0-video2md
- Continue building in v0: https://v0.app/chat/WDNaYAAY4qX
