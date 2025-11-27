CREATE TYPE "public"."extraction_status" AS ENUM('pending', 'in_progress', 'completed', 'failed');--> statement-breakpoint
CREATE TABLE "video_slide_extractions" (
	"video_id" varchar(32) PRIMARY KEY NOT NULL,
	"run_id" varchar(64),
	"status" "extraction_status" DEFAULT 'pending' NOT NULL,
	"total_slides" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "video_slides" (
	"id" serial PRIMARY KEY NOT NULL,
	"video_id" varchar(32) NOT NULL,
	"slide_index" integer NOT NULL,
	"chapter_index" integer NOT NULL,
	"frame_id" varchar(64) NOT NULL,
	"start_time" integer NOT NULL,
	"end_time" integer NOT NULL,
	"image_url" text NOT NULL,
	"has_text" boolean DEFAULT false NOT NULL,
	"text_confidence" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "unique_video_slide" UNIQUE("video_id","frame_id")
);
--> statement-breakpoint
ALTER TABLE "video_slide_extractions" ADD CONSTRAINT "video_slide_extractions_video_id_videos_video_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."videos"("video_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_slides" ADD CONSTRAINT "video_slides_video_id_videos_video_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."videos"("video_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "video_slides_video_id_idx" ON "video_slides" USING btree ("video_id");