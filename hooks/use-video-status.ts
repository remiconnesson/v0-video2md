"use client";

import { useCallback, useState } from "react";

export interface AnalysisRun {
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

export interface UseVideoStatusReturn {
  runs: AnalysisRun[];
  selectedRun: AnalysisRun | null;
  fetchRuns: () => Promise<{
    runs: AnalysisRun[];
    streamingRun: StreamingRunInfo | null;
  }>;
  handleVersionChange: (version: number) => void;
  setRuns: React.Dispatch<React.SetStateAction<AnalysisRun[]>>;
  setSelectedRun: React.Dispatch<React.SetStateAction<AnalysisRun | null>>;
}

export function useVideoStatus(
  youtubeId: string,
  initialVersion?: number,
): UseVideoStatusReturn {
  const [runs, setRuns] = useState<AnalysisRun[]>([]);
  const [selectedRun, setSelectedRun] = useState<AnalysisRun | null>(null);

  // ============================================================================
  // Fetch Runs
  // ============================================================================

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

  // ============================================================================
  // Handle Version Change
  // ============================================================================

  const handleVersionChange = useCallback(
    (version: number) => {
      const run = runs.find((r) => r.version === version);
      if (run) {
        setSelectedRun(run);
      }
    },
    [runs],
  );

  return {
    runs,
    selectedRun,
    fetchRuns,
    handleVersionChange,
    setRuns,
    setSelectedRun,
  };
}
