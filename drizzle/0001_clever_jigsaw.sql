CREATE TABLE "video_book_content" (
	"video_id" varchar(32) PRIMARY KEY NOT NULL,
	"video_summary" text NOT NULL,
	"chapters" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "video_book_content" ADD CONSTRAINT "video_book_content_video_id_videos_video_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."videos"("video_id") ON DELETE cascade ON UPDATE no action;