"use client";

import {
  ExternalLink,
  Loader2,
  Play,
  RefreshCw,
  Sparkles,
  Youtube,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { AnalysisRun, VideoInfo } from "@/hooks/use-video-processing";
import { useVideoProcessing } from "@/hooks/use-video-processing";
import type { SlidesState } from "@/lib/slides-types";
import { isRecord } from "@/lib/type-utils";
import { AnalysisPanel } from "./analysis-panel";
import { RerollDialog } from "./reroll-dialog";
import { SlidesPanel } from "./slides-panel";
import { VersionSelector } from "./version-selector";

interface AnalyzeViewProps {
  youtubeId: string;
  initialVersion?: number;
}

export function AnalyzeView({ youtubeId, initialVersion }: AnalyzeViewProps) {
  const [rerollOpen, setRerollOpen] = useState(false);

  const {
    pageStatus,
    videoInfo,
    runs,
    selectedRun,
    transcriptState,
    analysisState,
    slidesState,
    isAnalysisRunning,
    hasRuns,
    displayResult,
    handleFetchTranscript,
    handleVersionChange,
    handleStartAnalysis,
    handleReroll,
    setSlidesState,
  } = useVideoProcessing(youtubeId, initialVersion);

  // Loading state
  if (pageStatus === "loading") {
    return <LoadingIndication />;
  }

  if (pageStatus === "no_transcript") {
    return (
      <NoTranscriptLayout>
        <FetchTranscriptButton onClick={handleFetchTranscript} />
      </NoTranscriptLayout>
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

      {/* TODO this blinks somehow, seems that we start at !hasRuns even if we have runs
        This should probably be pushed on the server / use suspense
        */}
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
        onSubmit={(instructions) => {
          setRerollOpen(false);
          handleReroll(instructions);
        }}
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
      <VideoInfoDisplay videoInfo={videoInfo} youtubeId={youtubeId} />
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

function VideoInfoDisplay({
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

/** **/
function LoadingIndication() {
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  );
}

function NoTranscriptLayout({ children }: { children: React.ReactNode }) {
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
        {children}
      </div>
    </Card>
  );
}

function FetchTranscriptButton({ onClick }: { onClick: () => void }) {
  return (
    <Button onClick={onClick} size="lg" className="gap-2">
      <Play className="h-4 w-4" />
      Fetch Transcript
    </Button>
  );
}
