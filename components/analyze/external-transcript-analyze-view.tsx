"use client";

import { Loader2, Play, RefreshCw, Sparkles } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type {
  AnalysisRun,
  TranscriptInfo,
} from "@/hooks/use-external-transcript-processing";
import { useExternalTranscriptProcessing } from "@/hooks/use-external-transcript-processing";
import { AnalysisPanel } from "./analysis-panel";
import { RerollDialog } from "./reroll-dialog";
import { VersionSelector } from "./version-selector";

interface ExternalTranscriptAnalyzeViewProps {
  transcriptId: string;
  initialVersion?: number;
}

export function ExternalTranscriptAnalyzeView({
  transcriptId,
  initialVersion,
}: ExternalTranscriptAnalyzeViewProps) {
  const [rerollOpen, setRerollOpen] = useState(false);

  const {
    pageStatus,
    transcriptInfo,
    runs,
    selectedRun,
    analysisState,
    isAnalysisRunning,
    hasRuns,
    displayResult,
    handleVersionChange,
    handleStartAnalysis,
    handleReroll,
  } = useExternalTranscriptProcessing(transcriptId, initialVersion);

  // Loading state
  if (pageStatus === "loading") {
    return <LoadingIndication />;
  }

  if (pageStatus === "error") {
    return (
      <Card className="p-12">
        <div className="text-center text-red-600">
          <p>Failed to load transcript</p>
        </div>
      </Card>
    );
  }

  // Ready - main UI
  return (
    <div className="space-y-6">
      <TranscriptHeader
        transcriptInfo={transcriptInfo}
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
        <AnalysisResultCard
          displayResult={displayResult}
          selectedRun={selectedRun}
          transcriptId={transcriptId}
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
// Sub-components
// ============================================================================

function LoadingIndication() {
  return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  );
}

function TranscriptHeader({
  transcriptInfo,
  hasRuns,
  runs,
  selectedRun,
  isAnalysisRunning,
  onVersionChange,
  onRerollClick,
}: {
  transcriptInfo: TranscriptInfo | null;
  hasRuns: boolean;
  runs: AnalysisRun[];
  selectedRun: AnalysisRun | null;
  isAnalysisRunning: boolean;
  onVersionChange: (version: number) => void;
  onRerollClick: () => void;
}) {
  return (
    <Card className="p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold mb-2 break-words">
            {transcriptInfo?.title || "Loading..."}
          </h1>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
            {transcriptInfo?.author && (
              <span className="flex items-center gap-1">
                <span className="font-medium">Author:</span>
                {transcriptInfo.author}
              </span>
            )}
            {transcriptInfo?.source && (
              <span className="flex items-center gap-1">
                <span className="font-medium">Source:</span>
                {transcriptInfo.source}
              </span>
            )}
          </div>
          {transcriptInfo?.description && (
            <p className="mt-2 text-sm text-muted-foreground">
              {transcriptInfo.description}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {hasRuns && (
            <>
              <VersionSelector
                versions={runs.map((r) => r.version)}
                currentVersion={selectedRun?.version ?? 1}
                onVersionChange={onVersionChange}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={onRerollClick}
                disabled={isAnalysisRunning}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Reroll
              </Button>
            </>
          )}
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
          <p className="text-muted-foreground mt-1">
            Start AI analysis to generate a structured summary of your
            transcript
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

function ProgressIndicator({ message }: { message: string }) {
  return (
    <Card className="p-8">
      <div className="text-center space-y-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
        <p className="text-muted-foreground">{message}</p>
      </div>
    </Card>
  );
}

function AnalysisResultCard({
  displayResult,
  selectedRun,
  transcriptId,
}: {
  displayResult: unknown;
  selectedRun: AnalysisRun | null;
  transcriptId: string;
}) {
  return (
    <Card className="p-6">
      <AnalysisPanel
        analysis={displayResult as Record<string, unknown>}
        runId={selectedRun?.id ?? null}
        videoId={transcriptId}
      />
    </Card>
  );
}
