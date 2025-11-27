"use client";

import { Loader2, Play, RefreshCw, Sparkles } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import type { GodPromptOutput } from "@/ai/dynamic-analysis-schema";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useDynamicAnalysis } from "@/hooks/use-dynamic-analysis";
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
  analysis: Record<string, unknown> | null;
  additionalInstructions: string | null;
  createdAt: string;
}

interface AnalyzeViewProps {
  youtubeId: string;
  initialVersion?: number;
}

export function AnalyzeView({ youtubeId, initialVersion }: AnalyzeViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [runs, setRuns] = useState<AnalysisRun[]>([]);
  const [selectedRun, setSelectedRun] = useState<AnalysisRun | null>(null);
  const [isLoadingRuns, setIsLoadingRuns] = useState(true);
  const [rerollOpen, setRerollOpen] = useState(false);

  const { state, startAnalysis, abort } = useDynamicAnalysis(youtubeId);

  // Fetch existing runs
  const fetchRuns = useCallback(async () => {
    try {
      const res = await fetch(`/api/video/${youtubeId}/analyze`);
      if (!res.ok) return;
      const data = await res.json();
      setRuns(data.runs);

      // Select the appropriate run
      if (data.runs.length > 0) {
        const targetVersion = initialVersion ?? data.runs[0].version;
        const run = data.runs.find(
          (r: AnalysisRun) => r.version === targetVersion,
        );
        setSelectedRun(run ?? data.runs[0]);
      }
    } catch (err) {
      console.error("Failed to fetch runs:", err);
    } finally {
      setIsLoadingRuns(false);
    }
  }, [youtubeId, initialVersion]);

  useEffect(() => {
    fetchRuns();
  }, [fetchRuns]);

  // When analysis completes, refresh runs and select the new one
  useEffect(() => {
    if (state.status === "completed" && state.runId) {
      fetchRuns().then(() => {
        // Update URL with new version
        const params = new URLSearchParams(searchParams.toString());
        const newVersion = runs.length + 1; // Approximate, will be corrected on refetch
        params.set("v", newVersion.toString());
        router.push(`?${params.toString()}`, { scroll: false });
      });
    }
  }, [state.status, state.runId, fetchRuns, router, searchParams, runs.length]);

  // Handle version change
  const handleVersionChange = (version: number) => {
    const run = runs.find((r) => r.version === version);
    if (run) {
      setSelectedRun(run);
      const params = new URLSearchParams(searchParams.toString());
      params.set("v", version.toString());
      router.push(`?${params.toString()}`, { scroll: false });
    }
  };

  // Handle new analysis
  const handleStartAnalysis = () => {
    startAnalysis();
  };

  // Handle reroll with instructions
  const handleReroll = (instructions: string) => {
    setRerollOpen(false);
    startAnalysis(instructions);
  };

  // Determine what to show
  const isRunning = state.status === "running";
  const hasRuns = runs.length > 0;
  const displayResult = isRunning
    ? state.result
    : selectedRun
      ? {
          reasoning: selectedRun.reasoning ?? "",
          schema: selectedRun.generatedSchema ?? { sections: {} },
          analysis: selectedRun.analysis ?? {},
        }
      : null;

  if (isLoadingRuns) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dynamic Analysis</h1>
          <p className="text-muted-foreground">
            AI-powered extraction tailored to this specific content
          </p>
        </div>

        <div className="flex items-center gap-3">
          {hasRuns && (
            <VersionSelector
              versions={runs.map((r) => r.version)}
              currentVersion={selectedRun?.version ?? 1}
              onVersionChange={handleVersionChange}
            />
          )}

          {isRunning ? (
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

          {!isRunning && !hasRuns && (
            <Button onClick={handleStartAnalysis} className="gap-2">
              <Sparkles className="h-4 w-4" />
              Start Analysis
            </Button>
          )}
        </div>
      </div>

      {/* Progress indicator when running */}
      {isRunning && (
        <Card className="p-4 border-primary/20 bg-primary/5">
          <div className="flex items-center gap-4">
            <div className="relative">
              <Sparkles className="h-6 w-6 text-primary" />
              <Loader2 className="h-4 w-4 animate-spin text-primary absolute -bottom-1 -right-1" />
            </div>
            <div>
              <p className="font-medium">Analyzing transcript...</p>
              <p className="text-sm text-muted-foreground">{state.message}</p>
            </div>
          </div>
        </Card>
      )}

      {/* Empty state */}
      {!hasRuns && !isRunning && (
        <Card className="p-12">
          <div className="text-center space-y-4">
            <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Sparkles className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-semibold">No analysis yet</h2>
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
        <Tabs defaultValue="reasoning" className="space-y-4">
          <TabsList>
            <TabsTrigger value="reasoning">Reasoning</TabsTrigger>
            <TabsTrigger value="schema">Schema</TabsTrigger>
            <TabsTrigger value="analysis">Analysis</TabsTrigger>
          </TabsList>

          <TabsContent value="reasoning">
            <ReasoningPanel
              reasoning={displayResult.reasoning}
              isStreaming={isRunning}
            />
          </TabsContent>

          <TabsContent value="schema">
            <SchemaPanel
              schema={displayResult.schema}
              runId={selectedRun?.id ?? null}
              videoId={youtubeId}
            />
          </TabsContent>

          <TabsContent value="analysis">
            <AnalysisPanel
              analysis={displayResult.analysis}
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
