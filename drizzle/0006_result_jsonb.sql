-- Add the new result column
ALTER TABLE "video_analysis_runs" ADD COLUMN "result" jsonb;--> statement-breakpoint

-- Migrate existing data: combine reasoning, generated_schema, and analysis into result
UPDATE "video_analysis_runs" 
SET "result" = jsonb_build_object(
  'reasoning', COALESCE("reasoning", ''),
  'schema', COALESCE("generated_schema", '{"sections": []}'::jsonb),
  'analysis', COALESCE("analysis", '{"required_sections": {"tldr": "", "transcript_corrections": "", "detailed_summary": ""}, "additional_sections": []}'::jsonb)
)
WHERE "reasoning" IS NOT NULL OR "generated_schema" IS NOT NULL OR "analysis" IS NOT NULL;--> statement-breakpoint

-- Drop the old columns
ALTER TABLE "video_analysis_runs" DROP COLUMN "reasoning";--> statement-breakpoint
ALTER TABLE "video_analysis_runs" DROP COLUMN "generated_schema";--> statement-breakpoint
ALTER TABLE "video_analysis_runs" DROP COLUMN "analysis";

