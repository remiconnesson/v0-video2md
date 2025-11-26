export enum JobStatus {
  PENDING = "pending",
  DOWNLOADING = "downloading",
  EXTRACTING = "extracting",
  UPLOADING = "uploading",
  COMPLETED = "completed",
  FAILED = "failed",
}

export interface JobUpdate {
  status: JobStatus;
  progress: number;
  message: string;
  updated_at: string;
  video_id?: string;
  metadata_uri?: string;
  error?: string;
}

export interface SlideManifest {
  [videoId: string]: {
    segments: VideoSegment[];
  };
}

export type VideoSegment = MovingSegment | StaticSegment;

export interface BaseSegment {
  start_time: number;
  end_time: number;
}

export interface MovingSegment extends BaseSegment {
  kind: "moving";
}

export interface StaticSegment extends BaseSegment {
  kind: "static";
  frame_id: string;
  url: string;
  s3_uri: string;
  s3_key: string;
  s3_bucket: string;
  has_text: boolean;
  text_confidence: number;
  text_box_count: number;
  skip_reason: string | null;
}

export interface SlideStreamEvent {
  type: "progress" | "slide" | "complete" | "error";
  data: ProgressEvent | SlideEvent | CompleteEvent | ErrorEvent;
}

export interface ProgressEvent {
  status: JobStatus;
  progress: number;
  message: string;
}

export interface SlideEvent {
  slide_index: number;
  chapter_index: number;
  frame_id: string;
  start_time: number;
  end_time: number;
  image_url: string;
  has_text: boolean;
  text_confidence: number;
}

export interface CompleteEvent {
  total_slides: number;
  video_id: string;
}

export interface ErrorEvent {
  message: string;
  code?: string;
}
