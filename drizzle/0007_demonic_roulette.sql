ALTER TABLE "derived_analysis_runs" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "derived_analysis_runs" CASCADE;--> statement-breakpoint
ALTER TABLE "section_feedback" DROP CONSTRAINT "section_feedback_derived_run_id_derived_analysis_runs_id_fk";
--> statement-breakpoint
DROP INDEX "section_feedback_derived_idx";--> statement-breakpoint
ALTER TABLE "section_feedback" DROP COLUMN "derived_run_id";