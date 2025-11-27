CREATE TYPE "public"."analysis_status" AS ENUM('pending', 'streaming', 'completed', 'failed');--> statement-breakpoint
CREATE TABLE "derived_analysis_runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"source_run_id" integer NOT NULL,
	"analysis" jsonb,
	"status" "analysis_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "run_feedback" (
	"id" serial PRIMARY KEY NOT NULL,
	"run_id" integer NOT NULL,
	"overall_rating" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "section_feedback" (
	"id" serial PRIMARY KEY NOT NULL,
	"run_id" integer NOT NULL,
	"derived_run_id" integer,
	"section_key" varchar(128) NOT NULL,
	"rating" varchar(16),
	"comment" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "video_analysis_runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"video_id" varchar(32) NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"reasoning" text,
	"generated_schema" jsonb,
	"analysis" jsonb,
	"additional_instructions" text,
	"status" "analysis_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "video_analysis_runs_version" UNIQUE("video_id","version")
);
--> statement-breakpoint
ALTER TABLE "derived_analysis_runs" ADD CONSTRAINT "derived_analysis_runs_source_run_id_video_analysis_runs_id_fk" FOREIGN KEY ("source_run_id") REFERENCES "public"."video_analysis_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "run_feedback" ADD CONSTRAINT "run_feedback_run_id_video_analysis_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."video_analysis_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "section_feedback" ADD CONSTRAINT "section_feedback_run_id_video_analysis_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."video_analysis_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "section_feedback" ADD CONSTRAINT "section_feedback_derived_run_id_derived_analysis_runs_id_fk" FOREIGN KEY ("derived_run_id") REFERENCES "public"."derived_analysis_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_analysis_runs" ADD CONSTRAINT "video_analysis_runs_video_id_videos_video_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."videos"("video_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "derived_analysis_source_idx" ON "derived_analysis_runs" USING btree ("source_run_id");--> statement-breakpoint
CREATE INDEX "section_feedback_run_idx" ON "section_feedback" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "section_feedback_derived_idx" ON "section_feedback" USING btree ("derived_run_id");--> statement-breakpoint
CREATE INDEX "video_analysis_runs_video_idx" ON "video_analysis_runs" USING btree ("video_id");