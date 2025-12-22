export type SlideAnalysisStatus =
  | "pending"
  | "analyzing"
  | "completed"
  | "failed";

export interface SlideAnalysisProgress {
  slideNumber: number;
  framePosition: "first" | "last";
  status: SlideAnalysisStatus;
  error?: string;
}

export type SuperAnalysisStreamEvent =
  | {
      type: "progress";
      phase: string;
      message: string;
    }
  | {
      type: "slide_analysis_progress";
      slides: SlideAnalysisProgress[];
      completedCount: number;
      totalCount: number;
    }
  | {
      type: "partial";
      data: string;
    }
  | {
      type: "result";
      data: string;
    }
  | {
      type: "complete";
      runId: number;
    }
  | {
      type: "error";
      message: string;
    };

export interface SuperAnalysisInputData {
  videoId: string;
  title: string;
  channelName: string;
  description: string | null;
  durationSeconds: number | null;
  transcriptAnalysis: Record<string, unknown>;
  slidesAnalysis: Array<{
    slideNumber: number;
    framePosition: "first" | "last";
    markdown: string;
    imageUrl: string;
    startTime: number;
    endTime: number;
  }>;
  transcriptSegments: Array<{
    start: number;
    end: number;
    text: string;
  }>;
}
