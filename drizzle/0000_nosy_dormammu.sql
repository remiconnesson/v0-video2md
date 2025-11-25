CREATE TABLE "channels" (
	"channel_id" varchar(64) PRIMARY KEY NOT NULL,
	"channel_name" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scrap_transcript_v1" (
	"id" serial PRIMARY KEY NOT NULL,
	"video_id" varchar(32) NOT NULL,
	"channel_id" varchar(64) NOT NULL,
	"description" text,
	"subscriber_count" integer,
	"view_count" integer,
	"like_count" integer,
	"duration_seconds" integer,
	"is_auto_generated" boolean,
	"thumbnail" text,
	"transcript" jsonb,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "unique_video_transcript" UNIQUE("video_id")
);
--> statement-breakpoint
CREATE TABLE "videos" (
	"video_id" varchar(32) PRIMARY KEY NOT NULL,
	"url" text NOT NULL,
	"title" text NOT NULL,
	"published_at" timestamp with time zone,
	"channel_id" varchar(64) NOT NULL
);
--> statement-breakpoint
ALTER TABLE "scrap_transcript_v1" ADD CONSTRAINT "scrap_transcript_v1_video_id_videos_video_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."videos"("video_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scrap_transcript_v1" ADD CONSTRAINT "scrap_transcript_v1_channel_id_channels_channel_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("channel_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "videos" ADD CONSTRAINT "videos_channel_id_channels_channel_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("channel_id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "videos_channel_id_idx" ON "videos" USING btree ("channel_id");