export type SuperAnalysisStreamEvent =
  | {
      type: "progress";
      phase: string;
      message: string;
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
