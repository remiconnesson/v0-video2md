"use client";

import { FileText, Loader2, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Streamdown } from "streamdown";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type {
  SlideAnalysisStreamEvent,
  SlideAnalysisTarget,
  SlideData,
  SlideFeedbackData,
} from "@/lib/slides-types";
import { consumeSSE } from "@/lib/sse";
import {
  CoverageStatus,
  type CoverageStatusType,
  SlideAnalysisStatus,
  type SlideAnalysisStatusType,
} from "@/lib/status-types";

interface SlideAnalysisResult {
  slideNumber: number;
  framePosition: "first" | "last";
  markdown: string;
  createdAt?: string;
}

interface SlideAnalysisPanelProps {
  videoId: string;
}

type AnalysisStatus = SlideAnalysisStatusType;

export function SlideAnalysisPanel({ videoId }: SlideAnalysisPanelProps) {
  const [status, setStatus] = useState<AnalysisStatus>(
    SlideAnalysisStatus.LOADING,
  );
  const [results, setResults] = useState<SlideAnalysisResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState({ current: 0, message: "" });
  const [coverageStatus, setCoverageStatus] = useState<CoverageStatusType>(
    CoverageStatus.IDLE,
  );
  const [coverageError, setCoverageError] = useState<string | null>(null);
  const [pickedTargets, setPickedTargets] = useState<SlideAnalysisTarget[]>([]);

  // Load existing analysis results
  const loadResults = useCallback(async () => {
    setStatus(SlideAnalysisStatus.LOADING);
    setError(null);

    try {
      const response = await fetch(`/api/video/${videoId}/slides/analysis`);
      if (!response.ok) {
        throw new Error("Failed to load analysis results");
      }

      const data = await response.json();
      setResults(data.results);
      setStatus(
        data.results.length > 0
          ? SlideAnalysisStatus.COMPLETED
          : SlideAnalysisStatus.IDLE,
      );
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to load results";
      setError(errorMessage);
      setStatus(SlideAnalysisStatus.ERROR);
    }
  }, [videoId]);

  const loadCoverage = useCallback(async () => {
    setCoverageStatus(CoverageStatus.LOADING);
    setCoverageError(null);

    try {
      const [slidesResponse, feedbackResponse] = await Promise.all([
        fetch(`/api/video/${videoId}/slides`),
        fetch(`/api/video/${videoId}/slides/feedback`),
      ]);

      if (!slidesResponse.ok) {
        throw new Error("Failed to load slides");
      }

      if (!feedbackResponse.ok) {
        throw new Error("Failed to load slide feedback");
      }

      const slidesData = await slidesResponse.json();
      const feedbackData = await feedbackResponse.json();

      const slides: SlideData[] = slidesData.slides ?? [];
      const feedback: SlideFeedbackData[] = feedbackData.feedback ?? [];
      const feedbackMap = new Map(
        feedback.map((entry) => [entry.slideNumber, entry]),
      );

      const targets: SlideAnalysisTarget[] = [];
      for (const slide of slides) {
        const entry = feedbackMap.get(slide.slideNumber);
        const isFirstPicked = entry?.isFirstFramePicked ?? false;
        const isLastPicked = entry?.isLastFramePicked ?? false;

        if (isFirstPicked && slide.firstFrameImageUrl) {
          targets.push({
            slideNumber: slide.slideNumber,
            framePosition: "first",
          });
        }

        if (isLastPicked && slide.lastFrameImageUrl) {
          targets.push({
            slideNumber: slide.slideNumber,
            framePosition: "last",
          });
        }
      }

      setPickedTargets(targets);
      setCoverageStatus(CoverageStatus.READY);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to load slide coverage";
      setCoverageError(errorMessage);
      setCoverageStatus(CoverageStatus.ERROR);
    }
  }, [videoId]);

  const resultKeys = useMemo(() => {
    return new Set(
      results.map((result) => `${result.slideNumber}-${result.framePosition}`),
    );
  }, [results]);

  const missingTargets = useMemo(() => {
    if (pickedTargets.length === 0) {
      return [];
    }

    return pickedTargets.filter(
      (target) =>
        !resultKeys.has(`${target.slideNumber}-${target.framePosition}`),
    );
  }, [pickedTargets, resultKeys]);

  const matchedCount = pickedTargets.length - missingTargets.length;

  // Start analysis
  const startAnalysis = useCallback(
    async (targets?: SlideAnalysisTarget[]) => {
      setStatus(SlideAnalysisStatus.ANALYZING);
      setError(null);
      setProgress({
        current: 0,
        message: targets?.length
          ? "Starting analysis for missing slides..."
          : "Starting analysis...",
      });

      try {
        const response = await fetch(`/api/video/${videoId}/slides/analysis`, {
          method: "POST",
          headers: targets?.length
            ? {
                "Content-Type": "application/json",
              }
            : undefined,
          body: targets?.length ? JSON.stringify({ targets }) : undefined,
        });

        if (!response.ok) {
          const errorData = await response
            .json()
            .catch(() => ({ error: "Failed to start analysis" }));
          throw new Error(errorData.error);
        }

        await consumeSSE<SlideAnalysisStreamEvent>(response, {
          progress: (e) => {
            setProgress({ current: e.progress, message: e.message });
          },
          slide_markdown: (e) => {
            setResults((prev) => {
              // Update or add result
              const existing = prev.findIndex(
                (r) =>
                  r.slideNumber === e.slideNumber &&
                  r.framePosition === e.framePosition,
              );
              if (existing >= 0) {
                const updated = [...prev];
                updated[existing] = {
                  slideNumber: e.slideNumber,
                  framePosition: e.framePosition,
                  markdown: e.markdown,
                };
                return updated;
              }
              return [
                ...prev,
                {
                  slideNumber: e.slideNumber,
                  framePosition: e.framePosition,
                  markdown: e.markdown,
                },
              ];
            });
          },
          complete: () => {
            setStatus(SlideAnalysisStatus.COMPLETED);
            // Reload to get server-canonical results
            void loadResults();
            void loadCoverage();
          },
          error: (e) => {
            setError(e.message);
            setStatus(SlideAnalysisStatus.ERROR);
          },
        });
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Analysis failed";
        setError(errorMessage);
        setStatus(SlideAnalysisStatus.ERROR);
      }
    },
    [videoId, loadResults, loadCoverage],
  );

  useEffect(() => {
    void loadResults();
    void loadCoverage();
  }, [loadResults, loadCoverage]);

  // Loading state
  if (status === SlideAnalysisStatus.LOADING) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="flex items-center justify-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>Loading slide analysis...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Idle state - no results yet
  if (status === SlideAnalysisStatus.IDLE && results.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Slide Analysis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 space-y-4">
            <p className="text-muted-foreground">
              No slide analysis results yet. Go to the Slide Curation tab to
              select slides and run analysis.
            </p>
            <Button variant="outline" onClick={() => void startAnalysis()}>
              Analyze Selected Slides
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Analyzing state
  if (status === SlideAnalysisStatus.ANALYZING) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Loader2 className="h-5 w-5 animate-spin" />
            Analyzing Slides
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-md">
            <span className="text-sm">{progress.message}</span>
            <span className="text-sm text-muted-foreground ml-auto">
              {progress.current}%
            </span>
          </div>
          {results.length > 0 && (
            <div className="space-y-4">
              <p className="text-sm font-medium">
                {results.length} slide(s) analyzed so far
              </p>
              <AnalysisResultsList results={results} />
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  // Error state
  if (status === SlideAnalysisStatus.ERROR) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Slide Analysis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 space-y-4">
            <p className="text-destructive">{error}</p>
            <Button variant="outline" onClick={loadResults}>
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Completed state with results
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Slide Analysis ({results.length} slides)
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void startAnalysis()}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Re-analyze
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <SlideCoverageSummary
          status={coverageStatus}
          error={coverageError}
          totalPicked={pickedTargets.length}
          matchedCount={matchedCount}
          missingTargets={missingTargets}
          onRetry={loadCoverage}
          onAnalyzeMissing={() => void startAnalysis(missingTargets)}
        />
        <AnalysisResultsList results={results} />
      </CardContent>
    </Card>
  );
}

function AnalysisResultsList({ results }: { results: SlideAnalysisResult[] }) {
  // Sort results by slide number, then frame position
  const sortedResults = [...results].sort((a, b) => {
    if (a.slideNumber !== b.slideNumber) {
      return a.slideNumber - b.slideNumber;
    }
    return a.framePosition === "first" ? -1 : 1;
  });

  return (
    <div className="space-y-6">
      {sortedResults.map((result) => (
        <SlideAnalysisCard
          key={`${result.slideNumber}-${result.framePosition}`}
          result={result}
        />
      ))}
    </div>
  );
}

function SlideAnalysisCard({ result }: { result: SlideAnalysisResult }) {
  return (
    <div className="rounded-lg border p-4 space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium">
        <span>Slide #{result.slideNumber}</span>
        <span className="text-muted-foreground">
          ({result.framePosition} frame)
        </span>
      </div>
      <div className="prose prose-sm dark:prose-invert max-w-none">
        <MarkdownContent content={result.markdown} />
      </div>
    </div>
  );
}

function SlideCoverageSummary({
  status,
  error,
  totalPicked,
  matchedCount,
  missingTargets,
  onRetry,
  onAnalyzeMissing,
}: {
  status: CoverageStatusType;
  error: string | null;
  totalPicked: number;
  matchedCount: number;
  missingTargets: SlideAnalysisTarget[];
  onRetry: () => void;
  onAnalyzeMissing: () => void;
}) {
  if (status === "idle") {
    return null;
  }

  if (status === CoverageStatus.LOADING) {
    return (
      <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
        Checking for missing slides...
      </div>
    );
  }

  if (status === CoverageStatus.ERROR) {
    return (
      <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm">
        <p className="text-destructive">
          {error ?? "Unable to verify slide coverage."}
        </p>
        <Button className="mt-3" variant="outline" size="sm" onClick={onRetry}>
          Retry check
        </Button>
      </div>
    );
  }

  if (status === CoverageStatus.READY && totalPicked === 0) {
    return (
      <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
        No picked slides found. Go to Slide Curation to select frames for
        analysis.
      </div>
    );
  }

  const hasMissing = missingTargets.length > 0;
  const missingLabels = missingTargets.map(
    (target) => `#${target.slideNumber} (${target.framePosition})`,
  );

  return (
    <div
      className={
        hasMissing
          ? "rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-sm"
          : "rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-4 text-sm"
      }
    >
      <p className="font-medium">
        {hasMissing
          ? "Missing slide analyses detected."
          : "All selected slides are analyzed."}
      </p>
      <p className="mt-1 text-muted-foreground">
        {matchedCount} of {totalPicked} selected frame(s) analyzed.
      </p>
      {hasMissing ? (
        <div className="mt-3 space-y-2">
          <p className="text-muted-foreground">
            Missing: {missingLabels.join(", ")}
          </p>
          <Button size="sm" onClick={onAnalyzeMissing}>
            Analyze missing slides
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function MarkdownContent({ content }: { content: string }) {
  return (
    <div className="prose text-sm dark:prose-invert max-w-none prose-p:leading-relaxed prose-p:text-muted-foreground/90">
      <Streamdown>{content || ""}</Streamdown>
    </div>
  );
}
