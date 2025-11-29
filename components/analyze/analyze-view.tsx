"use client";

import {
  ExternalLink,
  Loader2,
  Play,
  RefreshCw,
  Sparkles,
  Youtube,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { AnalysisStreamEvent } from "@/app/workflows/dynamic-analysis";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { AnalysisState } from "@/hooks/use-dynamic-analysis";
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
  additionalInstructions: string | null;
  createdAt: string;
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

  const abortControllerRef = useRef<AbortController | null>(null);
  const autoStartedRef = useRef(false);

  const abort = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  const startAnalysisRun = useCallback(
    async (additionalInstructions?: string) => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      abortControllerRef.current = new AbortController();

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
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok || !response.body) {
          throw new Error("Failed to start analysis");
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const event = JSON.parse(line.slice(6)) as AnalysisStreamEvent;

                if (event.type === "progress") {
                  setAnalysisState((prev) => ({
                    ...prev,
                    phase: event.phase,
                    message: event.message,
                  }));
                } else if (event.type === "partial") {
                  setAnalysisState((prev) => ({
                    ...prev,
                    result: event.data,
                  }));
                } else if (event.type === "result") {
                  setAnalysisState((prev) => ({
                    ...prev,
                    result: event.data,
                  }));
                } else if (event.type === "complete") {
                  setAnalysisState((prev) => ({
                    ...prev,
                    status: "completed",
                    runId: event.runId,
                    phase: "complete",
                    message: "Analysis complete!",
                  }));
                } else if (event.type === "error") {
                  throw new Error(event.message);
                }
              } catch (parseError) {
                if (!(parseError instanceof SyntaxError)) {
                  throw parseError;
                }
              }
            }
          }
        }
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          return;
        }

        const errorMessage =
          err instanceof Error ? err.message : "Analysis failed";

        setAnalysisState((prev) => ({
          ...prev,
          status: "error",
          error: errorMessage,
        }));
      }
    },
    [youtubeId],
  );

  // Fetch existing analysis runs
  const fetchRuns = useCallback(async (): Promise<AnalysisRun[]> => {
    try {
      const res = await fetch(`/api/video/${youtubeId}/analyze`);
      if (!res.ok) return [];
      const data = await res.json();
      setRuns(data.runs);

      if (data.runs.length > 0) {
        const targetVersion = initialVersion ?? data.runs[0].version;
        const run = data.runs.find(
          (r: AnalysisRun) => r.version === targetVersion,
        );
        setSelectedRun(run ?? data.runs[0]);
      }

      return data.runs;
    } catch (err) {
      console.error("Failed to fetch runs:", err);
      return [];
    }
  }, [youtubeId, initialVersion]);

  const startProcessing = useCallback(async () => {
    if (autoStartedRef.current) return;
    autoStartedRef.current = true;

    setPageStatus("fetching_transcript");
    setTranscriptState({
      status: "fetching",
      progress: 10,
      message: "Connecting to YouTube...",
      error: null,
    });

    try {
      const res = await fetch(`/api/video/${youtubeId}/process`, {
        method: "POST",
      });

      if (!res.ok || !res.body) {
        throw new Error("Failed to start processing");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;

          try {
            const event = JSON.parse(line.slice(6));

            if (event.source === "meta") {
              // Meta events currently just expose the slide run id
              continue;
            }

            if (event.source === "transcript") {
              if (event.type === "progress") {
                setTranscriptState((prev) => ({
                  ...prev,
                  status: "fetching",
                  progress: event.progress ?? prev.progress,
                  message: event.message ?? prev.message,
                }));
              } else if (event.type === "complete") {
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
              } else if (event.type === "error") {
                setTranscriptState({
                  status: "error",
                  progress: 0,
                  message: "",
                  error: event.error,
                });
                setPageStatus("no_transcript");
              }
            }

            if (event.source === "analysis") {
              if (event.type === "progress") {
                setAnalysisState((prev) => ({
                  ...prev,
                  status: "running",
                  phase: event.phase,
                  message: event.message,
                }));
              } else if (event.type === "partial" || event.type === "result") {
                setAnalysisState((prev) => ({
                  ...prev,
                  status: "running",
                  result: event.data,
                }));
              } else if (event.type === "complete") {
                setAnalysisState((prev) => ({
                  ...prev,
                  status: "completed",
                  runId: event.runId,
                  phase: "complete",
                  message: "Analysis complete!",
                }));
              } else if (event.type === "error") {
                setAnalysisState((prev) => ({
                  ...prev,
                  status: "error",
                  error: event.message,
                }));
              }
            }
          } catch (parseError) {
            if (!(parseError instanceof SyntaxError)) {
              throw parseError;
            }
          }
        }
      }
    } catch (err) {
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
    try {
      const res = await fetch(`/api/video/${youtubeId}`);
      if (!res.ok) {
        setPageStatus("no_transcript");
        return;
      }

      const data = await res.json();

      if (data.status === "not_found") {
        setPageStatus("no_transcript");
        return;
      }

      // We have video data
      if (data.video) {
        setVideoInfo({
          title: data.video.title,
          channelName: data.video.channelName,
          thumbnail: data.video.thumbnail,
        });
      }

      // Check if transcript exists (processing or ready means we have it)
      if (data.status === "processing" || data.status === "ready") {
        setPageStatus("ready");
        // Fetch analysis runs
        await fetchRuns();
      } else {
        setPageStatus("no_transcript");
      }
    } catch (err) {
      console.error("Failed to check video status:", err);
      setPageStatus("no_transcript");
    }
  }, [youtubeId, fetchRuns]);

  // Initial load
  useEffect(() => {
    checkVideoStatus();
    startProcessing();
  }, [checkVideoStatus, startProcessing]);

  // When analysis completes, refresh runs
  useEffect(() => {
    if (analysisState.status === "completed" && analysisState.runId) {
      fetchRuns().then((updatedRuns) => {
        const params = new URLSearchParams(searchParams.toString());
        const newVersion = updatedRuns.length + 1;
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
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
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

        <div className="flex items-center gap-3 flex-shrink-0">
          {hasRuns && (
            <VersionSelector
              versions={runs.map((r) => r.version)}
              currentVersion={selectedRun?.version ?? 1}
              onVersionChange={handleVersionChange}
            />
          )}

          {isAnalysisRunning ? (
            <Button variant="outline" onClick={abort}>
              Cancel
            </Button>
          ) : hasRuns ? (
            <Button
              variant="outline"
              onClick={() => setRerollOpen(true)}
              className="gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Reroll
            </Button>
          ) : null}
        </div>
      </div>

      {!hasRuns && !isAnalysisRunning && (
        <EmptyState handleStartAnalysis={handleStartAnalysis} />
      )}

      {isAnalysisRunning ? (
        <ProgressIndicator message={analysisState.message} />
      ) : undefined}

      {/* Results */}
      {displayResult !== null && (
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
            <SlidesPanel videoId={youtubeId} />
          </TabsContent>
        </Tabs>
      )}

      {/* Reroll dialog */}
      <RerollDialog
        open={rerollOpen}
        onOpenChange={setRerollOpen}
        onSubmit={handleReroll}
        previousInstructions={selectedRun?.additionalInstructions ?? undefined}
      />
    </div>
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
