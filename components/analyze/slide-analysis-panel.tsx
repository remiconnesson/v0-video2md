"use client";

import { FileText, Loader2, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { SlideAnalysisStreamEvent } from "@/lib/slides-types";
import { consumeSSE } from "@/lib/sse";

interface SlideAnalysisResult {
  slideNumber: number;
  framePosition: "first" | "last";
  markdown: string;
  createdAt?: string;
}

interface SlideAnalysisPanelProps {
  videoId: string;
}

type AnalysisStatus = "idle" | "loading" | "analyzing" | "completed" | "error";

export function SlideAnalysisPanel({ videoId }: SlideAnalysisPanelProps) {
  const [status, setStatus] = useState<AnalysisStatus>("loading");
  const [results, setResults] = useState<SlideAnalysisResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState({ current: 0, message: "" });

  // Load existing analysis results
  const loadResults = useCallback(async () => {
    setStatus("loading");
    setError(null);

    try {
      const response = await fetch(`/api/video/${videoId}/slides/analysis`);
      if (!response.ok) {
        throw new Error("Failed to load analysis results");
      }

      const data = await response.json();
      setResults(data.results);
      setStatus(data.results.length > 0 ? "completed" : "idle");
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to load results";
      setError(errorMessage);
      setStatus("error");
    }
  }, [videoId]);

  // Start analysis
  const startAnalysis = useCallback(async () => {
    setStatus("analyzing");
    setError(null);
    setProgress({ current: 0, message: "Starting analysis..." });

    try {
      const response = await fetch(`/api/video/${videoId}/slides/analysis`, {
        method: "POST",
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
          setStatus("completed");
          // Reload to get server-canonical results
          void loadResults();
        },
        error: (e) => {
          setError(e.message);
          setStatus("error");
        },
      });
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Analysis failed";
      setError(errorMessage);
      setStatus("error");
    }
  }, [videoId, loadResults]);

  useEffect(() => {
    void loadResults();
  }, [loadResults]);

  // Loading state
  if (status === "loading") {
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
  if (status === "idle" && results.length === 0) {
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
            <Button variant="outline" onClick={startAnalysis}>
              Analyze Selected Slides
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Analyzing state
  if (status === "analyzing") {
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
  if (status === "error") {
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
          <Button variant="outline" size="sm" onClick={startAnalysis}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Re-analyze
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
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

function MarkdownContent({ content }: { content: string }) {
  // Simple markdown rendering - in production you might want a proper markdown parser
  // For now, just render as preformatted text with some basic styling
  return (
    <div className="whitespace-pre-wrap text-sm text-muted-foreground bg-muted/30 p-3 rounded-md overflow-auto max-h-96">
      {content}
    </div>
  );
}
