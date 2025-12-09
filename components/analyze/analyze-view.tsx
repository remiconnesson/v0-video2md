"use client";

import { Match } from "effect";
import {
  ExternalLink,
  Loader2,
  Play,
  RefreshCw,
  Sparkles,
  Youtube,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import type { ProcessingStreamEvent } from "@/app/api/video/[videoId]/process/route";
import type { AnalysisStreamEvent } from "@/app/workflows/dynamic-analysis";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { AnalysisState } from "@/hooks/use-dynamic-analysis";
import type { SlidesState } from "@/lib/slides-types";
import { consumeSSE } from "@/lib/sse";
import { isRecord } from "@/lib/type-utils";
import { AnalysisPanel } from "./analysis-panel";
import { RerollDialog } from "./reroll-dialog";
// Add import
import { SlidesPanel } from "./slides-panel";
import { VersionSelector } from "./version-selector";

interface AnalysisRun {
  id: number;
  version: number;
  status: string;
  result: unknown;
  workflowRunId: string | null;
  additionalInstructions: string | null;
  createdAt: string;
}

interface StreamingRunInfo {
  id: number;
  version: number;
  workflowRunId: string | null;
}

interface VideoInfo {
  title: string;
  channelName?: string;
  thumbnail?: string;
}

type PageStatus = "loading" | "no_transcript" | "fetching_transcript" | "ready";

type TranscriptStatus = "idle" | "fetching" | "completed" | "error";

interface AnalyzeViewProps {
  youtubeId: string;
  initialVersion?: number;
}

// TODO: initialversion smells
export function AnalyzeView({ youtubeId, initialVersion }: AnalyzeViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [pageStatus, setPageStatus] = useState<PageStatus>("loading");
  const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null);
  const [runs, setRuns] = useState<AnalysisRun[]>([]);
  const [selectedRun, setSelectedRun] = useState<AnalysisRun | null>(null);
  const [rerollOpen, setRerollOpen] = useState(false);

  const [transcriptState, setTranscriptState] = useState({
    status: "idle" as TranscriptStatus,
    progress: 0,
    message: "",
    error: null as string | null,
  });

  const [analysisState, setAnalysisState] = useState<AnalysisState>({
    status: "idle",
    phase: "",
    message: "",
    result: null,
    runId: null,
    error: null,
  });

  const [slidesState, setSlidesState] = useState<SlidesState>({
    status: "idle",
    progress: 0,
    message: "",
    error: null,
    slides: [],
  });

  // Fetch existing analysis runs and check for streaming runs
  const fetchRuns = useCallback(async (): Promise<{
    runs: AnalysisRun[];
    streamingRun: StreamingRunInfo | null;
  }> => {
    try {
      const res = await fetch(`/api/video/${youtubeId}/analyze`);
      if (!res.ok) return { runs: [], streamingRun: null };
      const data = await res.json();
      setRuns(data.runs);

      if (data.runs.length > 0) {
        const targetVersion = initialVersion ?? data.runs[0].version;
        const run = data.runs.find(
          (r: AnalysisRun) => r.version === targetVersion,
        );
        setSelectedRun(run ?? data.runs[0]);
      }

      return {
        runs: data.runs,
        streamingRun: data.streamingRun as StreamingRunInfo | null,
      };
    } catch (err) {
      console.error("Failed to fetch runs:", err);
      return { runs: [], streamingRun: null };
    }
  }, [youtubeId, initialVersion]);

  // Consume analysis stream events (shared between start and resume)
  const consumeAnalysisStream = useCallback(async (response: Response) => {
    await consumeSSE<AnalysisStreamEvent>(response, {
      progress: (event) =>
        setAnalysisState((prev) => ({
          ...prev,
          phase: event.phase,
          message: event.message,
        })),
      partial: (event) =>
        setAnalysisState((prev) => ({
          ...prev,
          result: event.data,
        })),
      result: (event) =>
        setAnalysisState((prev) => ({
          ...prev,
          result: event.data,
        })),
      complete: (event) =>
        setAnalysisState((prev) => ({
          ...prev,
          status: "completed",
          runId: event.runId,
          phase: "complete",
          message: "Analysis complete!",
        })),
      error: (event) => {
        throw new Error(event.message);
      },
    });
  }, []);

  // Resume an existing streaming analysis
  const resumeAnalysisStream = useCallback(async () => {
    setAnalysisState({
      status: "running",
      phase: "resuming",
      message: "Reconnecting to analysis...",
      result: null,
      runId: null,
      error: null,
    });

    try {
      const response = await fetch(`/api/video/${youtubeId}/analyze/resume`);

      if (!response.ok) {
        // Check if analysis completed while we were trying to reconnect
        let completed = false;
        try {
          const errorData = await response.json();
          completed = errorData.completed === true;
        } catch {
          // Ignore JSON parse errors
        }

        // Refetch runs to get current state
        const { runs: updatedRuns } = await fetchRuns();

        if (completed || updatedRuns.length > 0) {
          // Analysis finished - show the completed result
          const latestRun = updatedRuns[0];
          if (latestRun?.result) {
            setSelectedRun(latestRun);
          }
          setAnalysisState({
            status: "idle",
            phase: "",
            message: "",
            result: null,
            runId: null,
            error: null,
          });
          return;
        }
        throw new Error("Failed to resume analysis");
      }

      await consumeAnalysisStream(response);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to resume analysis";

      setAnalysisState((prev) => ({
        ...prev,
        status: "error",
        error: errorMessage,
      }));
    }
  }, [youtubeId, fetchRuns, consumeAnalysisStream]);

  const startAnalysisRun = useCallback(
    async (additionalInstructions?: string) => {
      setAnalysisState({
        status: "running",
        phase: "starting",
        message: "Starting analysis...",
        result: null,
        runId: null,
        error: null,
      });

      try {
        const response = await fetch(`/api/video/${youtubeId}/analyze`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ additionalInstructions }),
        });

        if (!response.ok) {
          throw new Error("Failed to start analysis");
        }

        await consumeAnalysisStream(response);
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Analysis failed";

        setAnalysisState((prev) => ({
          ...prev,
          status: "error",
          error: errorMessage,
        }));
      }
    },
    [youtubeId, consumeAnalysisStream],
  );

  // Load existing slides from DB
  const loadExistingSlides = useCallback(async () => {
    try {
      const res = await fetch(`/api/video/${youtubeId}/slides`);
      if (!res.ok) return;

      const data = await res.json();

      // If slides exist in DB, show them as completed regardless of extraction status
      // This handles the case where extraction finished but status wasn't updated
      if (data.slides.length > 0) {
        setSlidesState({
          status: "completed",
          progress: 100,
          message: `${data.slides.length} slides loaded`,
          error: null,
          slides: data.slides,
        });
      } else if (data.status === "in_progress") {
        // Extraction is in progress but no slides yet
        setSlidesState((prev) => ({
          ...prev,
          status: "extracting",
          progress: 0,
          message: "Extraction in progress...",
          slides: [],
        }));
      } else if (data.status === "failed") {
        // Extraction failed
        setSlidesState((prev) => ({
          ...prev,
          status: "error",
          error: data.errorMessage || "Extraction failed",
          slides: [],
        }));
      } else {
        setSlidesState((prev) => ({
          ...prev,
          status: "idle",
          slides: [],
        }));
      }
    } catch (err) {
      console.error("Failed to load existing slides:", err);
      setSlidesState((prev) => ({
        ...prev,
        status: "error",
        error: "Failed to load existing slides",
      }));
    }
  }, [youtubeId]);

  const startProcessing = useCallback(async () => {
    setPageStatus("fetching_transcript");
    setTranscriptState({
      status: "fetching",
      progress: 10,
      message: "Connecting to YouTube...",
      error: null,
    });
    setSlidesState((prev) => ({
      ...prev,
      status: "extracting",
      progress: 0,
      message: "Starting slides extraction...",
      error: null,
      slides: [],
    }));

    try {
      const res = await fetch(`/api/video/${youtubeId}/process`, {
        method: "POST",
      });

      if (!res.ok) {
        throw new Error("Failed to start processing");
      }

      await consumeSSE<ProcessingStreamEvent>(res, {
        slide: (event) => {
          setSlidesState((prev) => ({
            ...prev,
            slides: [...prev.slides, event.slide],
          }));
        },
        progress: (event) => {
          Match.value(event).pipe(
            Match.when({ source: "transcript" }, (event) => {
              setTranscriptState((prev) => ({
                ...prev,
                status: "fetching",
                progress: event.progress ?? prev.progress,
                message: event.message ?? prev.message,
              }));
            }),
            Match.when({ source: "analysis" }, (event) => {
              setAnalysisState((prev) => ({
                ...prev,
                status: "running",
                phase: event.phase,
                message: event.message,
              }));
            }),
            Match.when({ source: "slides" }, (event) => {
              setSlidesState((prev) => ({
                ...prev,
                status: "extracting",
                progress: event.progress ?? prev.progress,
                message: event.message ?? prev.message,
              }));
            }),
            Match.exhaustive,
          );
        },
        partial: (event) => {
          Match.value(event).pipe(
            Match.when({ source: "analysis" }, (event) => {
              setAnalysisState((prev) => ({
                ...prev,
                status: "running",
                result: event.data,
              }));
            }),
            Match.exhaustive,
          );
        },
        result: (event) => {
          Match.value(event).pipe(
            Match.when({ source: "analysis" }, (event) => {
              setAnalysisState((prev) => ({
                ...prev,
                status: "running",
                result: event.data,
              }));
            }),
            Match.exhaustive,
          );
        },
        complete: (event) => {
          Match.value(event).pipe(
            Match.when({ source: "transcript" }, (event) => {
              setTranscriptState({
                status: "completed",
                progress: 100,
                message: "Transcript fetched successfully",
                error: null,
              });

              if (event.video) {
                setVideoInfo({
                  title: event.video.title,
                  channelName: event.video.channelName,
                });
              }

              setPageStatus("ready");
            }),
            Match.when({ source: "analysis" }, (event) => {
              setAnalysisState((prev) => ({
                ...prev,
                status: "completed",
                runId: event.runId,
                phase: "complete",
                message: "Analysis complete!",
              }));
            }),
            Match.when({ source: "slides" }, (event) => {
              setSlidesState((prev) => ({
                ...prev,
                status: "completed",
                progress: 100,
                message: `Extracted ${event.totalSlides} slides`,
                error: null,
              }));
            }),
            Match.exhaustive,
          );
        },
        error: (event) => {
          Match.value(event).pipe(
            Match.when({ source: "transcript" }, (event) => {
              setTranscriptState({
                status: "error",
                progress: 0,
                message: "",
                error: event.error,
              });
              setPageStatus("no_transcript");
            }),
            Match.when({ source: "analysis" }, (event) => {
              setAnalysisState((prev) => ({
                ...prev,
                status: "error",
                error: event.message,
              }));
            }),
            Match.when({ source: "slides" }, (event) => {
              setSlidesState((prev) => ({
                ...prev,
                status: "error",
                progress: 0,
                message: "",
                error: event.message,
              }));
            }),
            Match.exhaustive,
          );
        },
      });
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        return;
      }

      console.error("Failed to start processing:", err);
      setPageStatus("no_transcript");
      setTranscriptState((prev) => ({
        ...prev,
        status: "error",
        error: err instanceof Error ? err.message : "Unknown error",
      }));
    }
  }, [youtubeId]);

  // Check video status and fetch runs
  const checkVideoStatus = useCallback(async () => {
    type VideoStatus = "not_found" | "processing" | "ready";

    let status: VideoStatus = "not_found";
    let hasStreamingAnalysis = false;

    try {
      const res = await fetch(`/api/video/${youtubeId}`);
      if (!res.ok) {
        setPageStatus("no_transcript");
        return { status, hasStreamingAnalysis };
      }

      const data = await res.json();
      status = data.status as VideoStatus;

      if (status === "not_found") {
        setPageStatus("no_transcript");
        return { status, hasStreamingAnalysis };
      }

      // We have video data
      if (data.video) {
        setVideoInfo({
          title: data.video.title,
          channelName: data.video.channelName,
          thumbnail: data.video.thumbnail,
        });
      }

      if (status === "ready") {
        setPageStatus("ready");
        setTranscriptState({
          status: "completed",
          progress: 100,
          message: "Transcript already fetched",
          error: null,
        });
        const [runsResult] = await Promise.all([
          fetchRuns(),
          loadExistingSlides(),
        ]);

        // Check if there's a streaming analysis to resume
        if (runsResult.streamingRun?.workflowRunId) {
          hasStreamingAnalysis = true;
        }
      } else if (status === "processing") {
        setPageStatus("fetching_transcript");
        setTranscriptState((prev) => ({
          ...prev,
          status: "fetching",
          progress: Math.max(prev.progress, 10),
          message: "Resuming transcript fetch...",
          error: null,
        }));
      } else {
        setPageStatus("no_transcript");
      }

      return { status, hasStreamingAnalysis };
    } catch (err) {
      console.error("Failed to check video status:", err);
      setPageStatus("no_transcript");
      return { status, hasStreamingAnalysis };
    }
  }, [youtubeId, fetchRuns, loadExistingSlides]);

  // Initial load
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const { status, hasStreamingAnalysis } = await checkVideoStatus();
      if (cancelled) return;

      if (status !== "ready") {
        startProcessing();
      } else if (hasStreamingAnalysis) {
        // Resume the streaming analysis if one is in progress
        resumeAnalysisStream();
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [checkVideoStatus, startProcessing, resumeAnalysisStream]);

  // When analysis completes, refresh runs
  useEffect(() => {
    if (analysisState.status === "completed" && analysisState.runId) {
      fetchRuns().then(({ runs: updatedRuns }) => {
        const params = new URLSearchParams(searchParams.toString());
        const newVersion = updatedRuns.length;
        params.set("v", newVersion.toString());
        router.push(`?${params.toString()}`, { scroll: false });
      });
    }
  }, [
    analysisState.status,
    analysisState.runId,
    fetchRuns,
    router,
    searchParams,
  ]);

  // Handlers
  const handleFetchTranscript = () => {
    setPageStatus("fetching_transcript");
    startProcessing();
  };

  const handleVersionChange = (version: number) => {
    const run = runs.find((r) => r.version === version);
    if (run) {
      setSelectedRun(run);
      const params = new URLSearchParams(searchParams.toString());
      params.set("v", version.toString());
      router.push(`?${params.toString()}`, { scroll: false });
    }
  };

  const handleStartAnalysis = () => {
    startAnalysisRun();
  };

  const handleReroll = (instructions: string) => {
    setRerollOpen(false);
    startAnalysisRun(instructions);
  };

  // Computed state
  const isAnalysisRunning = analysisState.status === "running";
  const hasRuns = runs.length > 0;
  const displayResult: unknown = isAnalysisRunning
    ? analysisState.result
    : (selectedRun?.result ?? null);

  // Loading state
  if (pageStatus === "loading") {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // No transcript - need to fetch first
  if (pageStatus === "no_transcript") {
    return (
      <Card className="p-12">
        <div className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
            <Youtube className="h-8 w-8 text-red-600" />
          </div>
          <div>
            <h2 className="text-xl font-semibold">Fetch Video First</h2>
            <p className="text-muted-foreground mt-1 max-w-md mx-auto">
              We need to fetch the transcript from YouTube before we can analyze
              it.
            </p>
          </div>
          <Button onClick={handleFetchTranscript} size="lg" className="gap-2">
            <Play className="h-4 w-4" />
            Fetch Transcript
          </Button>
        </div>
      </Card>
    );
  }

  // Fetching transcript
  if (pageStatus === "fetching_transcript") {
    return (
      <Card className="p-12">
        <div className="text-center space-y-6">
          <div className="relative mx-auto w-16 h-16">
            <Youtube className="h-16 w-16 text-red-600" />
            <Loader2 className="h-6 w-6 animate-spin text-primary absolute -bottom-1 -right-1" />
          </div>
          <div>
            <h2 className="text-xl font-semibold">Fetching Transcript</h2>
            <p className="text-muted-foreground mt-1">
              {transcriptState.message}
            </p>
          </div>
          <div className="max-w-md mx-auto">
            <Progress value={transcriptState.progress} className="h-2" />
          </div>
        </div>
      </Card>
    );
  }

  // Ready - main UI
  return (
    <div className="space-y-6">
      <VideoHeader
        videoInfo={videoInfo}
        youtubeId={youtubeId}
        hasRuns={hasRuns}
        runs={runs}
        selectedRun={selectedRun}
        isAnalysisRunning={isAnalysisRunning}
        onVersionChange={handleVersionChange}
        onRerollClick={() => setRerollOpen(true)}
      />

      {!hasRuns && !isAnalysisRunning && (
        <EmptyState handleStartAnalysis={handleStartAnalysis} />
      )}

      {isAnalysisRunning && (
        <ProgressIndicator message={analysisState.message} />
      )}

      {displayResult !== null && (
        <ResultsTabs
          displayResult={displayResult}
          isAnalysisRunning={isAnalysisRunning}
          selectedRun={selectedRun}
          youtubeId={youtubeId}
          slidesState={slidesState}
          onSlidesStateChange={setSlidesState}
        />
      )}

      <RerollDialog
        open={rerollOpen}
        onOpenChange={setRerollOpen}
        onSubmit={handleReroll}
        previousInstructions={selectedRun?.additionalInstructions ?? undefined}
      />
    </div>
  );
}

// ============================================================================
// Sub-components for better readability
// ============================================================================

function VideoHeader({
  videoInfo,
  youtubeId,
  hasRuns,
  runs,
  selectedRun,
  isAnalysisRunning,
  onVersionChange,
  onRerollClick,
}: {
  videoInfo: VideoInfo | null;
  youtubeId: string;
  hasRuns: boolean;
  runs: AnalysisRun[];
  selectedRun: AnalysisRun | null;
  isAnalysisRunning: boolean;
  onVersionChange: (version: number) => void;
  onRerollClick: () => void;
}) {
  const showRerollButton = !isAnalysisRunning && hasRuns;

  return (
    <div className="flex items-start justify-between gap-4">
      <VideoInfo videoInfo={videoInfo} youtubeId={youtubeId} />
      <HeaderActions
        hasRuns={hasRuns}
        runs={runs}
        selectedRun={selectedRun}
        showRerollButton={showRerollButton}
        onVersionChange={onVersionChange}
        onRerollClick={onRerollClick}
      />
    </div>
  );
}

function VideoInfo({
  videoInfo,
  youtubeId,
}: {
  videoInfo: VideoInfo | null;
  youtubeId: string;
}) {
  return (
    <div className="min-w-0">
      <h1 className="text-2xl font-bold truncate">
        {videoInfo?.title ?? "Video Analysis"}
      </h1>

      <div className="flex items-center gap-3 mt-1">
        {videoInfo?.channelName && (
          <span className="text-sm text-muted-foreground">
            {videoInfo.channelName}
          </span>
        )}

        <a
          href={`https://www.youtube.com/watch?v=${youtubeId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"
        >
          <ExternalLink className="h-3 w-3" />
          Watch
        </a>
      </div>
    </div>
  );
}

function HeaderActions({
  hasRuns,
  runs,
  selectedRun,
  showRerollButton,
  onVersionChange,
  onRerollClick,
}: {
  hasRuns: boolean;
  runs: AnalysisRun[];
  selectedRun: AnalysisRun | null;
  showRerollButton: boolean;
  onVersionChange: (version: number) => void;
  onRerollClick: () => void;
}) {
  return (
    <div className="flex items-center gap-3 flex-shrink-0">
      {hasRuns && (
        <VersionSelector
          versions={runs.map((r) => r.version)}
          currentVersion={selectedRun?.version ?? 1}
          onVersionChange={onVersionChange}
        />
      )}

      {showRerollButton && (
        <Button variant="outline" onClick={onRerollClick} className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Reroll
        </Button>
      )}
    </div>
  );
}

function ResultsTabs({
  displayResult,
  isAnalysisRunning,
  selectedRun,
  youtubeId,
  slidesState,
  onSlidesStateChange,
}: {
  displayResult: unknown;
  isAnalysisRunning: boolean;
  selectedRun: AnalysisRun | null;
  youtubeId: string;
  slidesState: SlidesState;
  onSlidesStateChange: (
    state: SlidesState | ((prev: SlidesState) => SlidesState),
  ) => void;
}) {
  return (
    <Tabs defaultValue="analysis" className="space-y-4">
      <TabsList>
        <TabsTrigger value="analysis">Analysis</TabsTrigger>
        <TabsTrigger value="slides">Slides</TabsTrigger>
      </TabsList>

      <TabsContent value="analysis">
        {isRecord(displayResult) && (
          <AnalysisPanel
            analysis={displayResult}
            runId={isAnalysisRunning ? null : (selectedRun?.id ?? null)}
            videoId={youtubeId}
          />
        )}
      </TabsContent>

      <TabsContent value="slides">
        <SlidesPanel
          videoId={youtubeId}
          slidesState={slidesState}
          onSlidesStateChange={onSlidesStateChange}
        />
      </TabsContent>
    </Tabs>
  );
}

function ProgressIndicator({ message }: { message: string }) {
  return (
    <Card className="p-4 border-primary/20 bg-primary/5">
      <div className="flex items-center gap-4">
        <div className="relative">
          <Sparkles className="h-6 w-6 text-primary" />
          <Loader2 className="h-4 w-4 animate-spin text-primary absolute -bottom-1 -right-1" />
        </div>

        <div>
          <p className="font-medium">Analyzing transcript...</p>
          <p className="text-sm text-muted-foreground">{message}</p>
        </div>
      </div>
    </Card>
  );
}

function EmptyState({
  handleStartAnalysis,
}: {
  handleStartAnalysis: () => void;
}) {
  return (
    <Card className="p-12">
      <div className="text-center space-y-4">
        <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
          <Sparkles className="h-8 w-8 text-primary" />
        </div>

        <div>
          <h2 className="text-xl font-semibold">Ready to Analyze</h2>
          <p className="text-muted-foreground mt-1 max-w-md mx-auto">
            Run the dynamic analysis to have AI reason about this video and
            extract the most useful information tailored to this specific
            content.
          </p>
        </div>

        <Button onClick={handleStartAnalysis} size="lg" className="gap-2">
          <Play className="h-4 w-4" />
          Start Analysis
        </Button>
      </div>
    </Card>
  );
}
