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

export interface StreamingRunInfo {
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
      const response = await fetch(`/api/video/${youtubeId}/analyze`);
      if (!response.ok) return { runs: [], streamingRun: null };
      const analysisData = await response.json();
      setRuns(analysisData.runs);

      if (analysisData.runs.length > 0) {
        const targetVersion = initialVersion ?? analysisData.runs[0].version;
        const matchingRun = analysisData.runs.find(
          (analysisRun: AnalysisRun) => analysisRun.version === targetVersion,
        );
        setSelectedRun(matchingRun ?? analysisData.runs[0]);
      }

      return {
        runs: analysisData.runs,
        streamingRun: analysisData.streamingRun as StreamingRunInfo | null,
      };
    } catch (fetchError) {
      console.error("Failed to fetch runs:", fetchError);
      return { runs: [], streamingRun: null };
    }
  }, [youtubeId, initialVersion]);

  // ============================================================================
  // Handle Version Change
  // ============================================================================

  const handleVersionChange = useCallback(
    (version: number) => {
      const matchingRun = runs.find(
        (analysisRun) => analysisRun.version === version,
      );
      if (matchingRun) {
        setSelectedRun(matchingRun);
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
