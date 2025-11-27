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
import { useCallback, useEffect, useState } from "react";
import type {
  GodPromptAnalysis,
  GodPromptOutput,
} from "@/ai/dynamic-analysis-prompt";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useDynamicAnalysis } from "@/hooks/use-dynamic-analysis";
import { useTranscriptFetcher } from "@/hooks/use-transcript-fetcher";
import { AnalysisPanel } from "./analysis-panel";
import { ReasoningPanel } from "./reasoning-panel";
import { RerollDialog } from "./reroll-dialog";
import { SchemaPanel } from "./schema-panel";
import { VersionSelector } from "./version-selector";

interface AnalysisRun {
  id: number;
  version: number;
  status: string;
  reasoning: string | null;
  generatedSchema: GodPromptOutput["schema"] | null;
  analysis: GodPromptAnalysis | null;
  additionalInstructions: string | null;
  createdAt: string;
}

interface VideoInfo {
  title: string;
  channelName?: string;
  thumbnail?: string;
}

type PageStatus = "loading" | "no_transcript" | "fetching_transcript" | "ready";

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

  const {
    state: analysisState,
    startAnalysis,
    abort,
  } = useDynamicAnalysis(youtubeId);
  const { state: transcriptState, startFetching } =
    useTranscriptFetcher(youtubeId);

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
  }, [checkVideoStatus]);

  // Handle transcript fetch completion
  useEffect(() => {
    if (transcriptState.status === "completed") {
      setPageStatus("ready");
      if (transcriptState.videoInfo) {
        setVideoInfo({
          title: transcriptState.videoInfo.title,
          channelName: transcriptState.videoInfo.channelName,
        });
      }
    }
  }, [transcriptState.status, transcriptState.videoInfo]);

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
    startFetching();
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
    startAnalysis();
  };

  const handleReroll = (instructions: string) => {
    setRerollOpen(false);
    startAnalysis(instructions);
  };

  // Computed state
  const isAnalysisRunning = analysisState.status === "running";
  const hasRuns = runs.length > 0;
  const emptyAnalysis: GodPromptAnalysis = {
    required_sections: {
      tldr: "",
      transcript_corrections: "",
      detailed_summary: "",
    },
    additional_sections: [],
  };
  const displayResult = isAnalysisRunning
    ? analysisState.result
    : selectedRun
      ? {
          reasoning: selectedRun.reasoning ?? "",
          schema: selectedRun.generatedSchema ?? { sections: {} },
          analysis: selectedRun.analysis ?? emptyAnalysis,
        }
      : null;

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

          {!isAnalysisRunning && !hasRuns && (
            <Button onClick={handleStartAnalysis} className="gap-2">
              <Sparkles className="h-4 w-4" />
              Start Analysis
            </Button>
          )}
        </div>
      </div>

      {/* Progress indicator when running */}
      {isAnalysisRunning && (
        <Card className="p-4 border-primary/20 bg-primary/5">
          <div className="flex items-center gap-4">
            <div className="relative">
              <Sparkles className="h-6 w-6 text-primary" />
              <Loader2 className="h-4 w-4 animate-spin text-primary absolute -bottom-1 -right-1" />
            </div>
            <div>
              <p className="font-medium">Analyzing transcript...</p>
              <p className="text-sm text-muted-foreground">
                {analysisState.message}
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Empty state */}
      {!hasRuns && !isAnalysisRunning && (
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
      )}

      {/* Results */}
      {displayResult && (
        <Tabs defaultValue="analysis" className="space-y-4">
          <TabsList>
            <TabsTrigger value="analysis">Analysis</TabsTrigger>
            <TabsTrigger value="reasoning">Reasoning</TabsTrigger>
            <TabsTrigger value="schema">Schema</TabsTrigger>
          </TabsList>

          <TabsContent value="analysis">
            <AnalysisPanel
              analysis={displayResult.analysis}
              schema={displayResult.schema}
              runId={selectedRun?.id ?? null}
              videoId={youtubeId}
            />
          </TabsContent>

          <TabsContent value="reasoning">
            <ReasoningPanel
              reasoning={displayResult.reasoning}
              isStreaming={isAnalysisRunning}
            />
          </TabsContent>

          <TabsContent value="schema">
            <SchemaPanel
              schema={displayResult.schema}
              runId={selectedRun?.id ?? null}
              videoId={youtubeId}
            />
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
