import { useCallback, useRef, useState } from "react";
import type {
  AnalysisValue,
  GodPromptAnalysis,
  GodPromptOutput,
  SectionEntry,
} from "@/ai/dynamic-analysis-prompt";
import type { AnalysisStreamEvent } from "@/app/workflows/dynamic-analysis";

type PartialGodPromptOutput = Extract<
  AnalysisStreamEvent,
  { type: "partial" }
>["data"];

const EMPTY_GOD_PROMPT_OUTPUT: GodPromptOutput = {
  reasoning: "",
  schema: { sections: [] },
  analysis: {
    required_sections: {
      tldr: "",
      transcript_corrections: "",
      detailed_summary: "",
    },
    additional_sections: [],
  },
};

function mergeSchemaSections(
  base: SectionEntry[],
  partial?: Partial<SectionEntry>[] | undefined,
): SectionEntry[] {
  if (!partial) return base;

  const result = [...base];

  for (const partialSection of partial) {
    if (!partialSection?.key) continue;

    const existingIdx = result.findIndex((s) => s.key === partialSection.key);

    if (existingIdx >= 0) {
      // Update existing
      result[existingIdx] = {
        ...result[existingIdx],
        ...partialSection,
      } as SectionEntry;
    } else {
      // Add new (only if it has required fields)
      if (partialSection.description && partialSection.type) {
        result.push(partialSection as SectionEntry);
      }
    }
  }

  return result;
}

function mergePartialResult(
  current: GodPromptOutput | null,
  partial: PartialGodPromptOutput,
): GodPromptOutput {
  const base = current ?? EMPTY_GOD_PROMPT_OUTPUT;

  // Merge schema sections (now array-based)
  const mergedSections = mergeSchemaSections(
    base.schema.sections,
    partial.schema?.sections,
  );

  // Merge analysis
  const mergedAnalysis: GodPromptAnalysis = {
    required_sections: {
      tldr:
        partial.analysis?.required_sections?.tldr ??
        base.analysis.required_sections.tldr,
      transcript_corrections:
        partial.analysis?.required_sections?.transcript_corrections ??
        base.analysis.required_sections.transcript_corrections,
      detailed_summary:
        partial.analysis?.required_sections?.detailed_summary ??
        base.analysis.required_sections.detailed_summary,
    },
    additional_sections: mergeAdditionalSections(
      base.analysis.additional_sections,
      partial.analysis?.additional_sections,
    ),
  };

  return {
    reasoning:
      typeof partial.reasoning === "string"
        ? partial.reasoning
        : base.reasoning,
    schema: {
      sections: mergedSections,
    },
    analysis: mergedAnalysis,
  };
}

function mergeAdditionalSections(
  base: AnalysisValue[],
  partial?: Partial<AnalysisValue>[] | undefined,
): AnalysisValue[] {
  if (!partial) return base;

  const result = [...base];

  for (const partialSection of partial) {
    if (!partialSection?.key) continue;

    const existingIdx = result.findIndex((s) => s.key === partialSection.key);

    if (existingIdx >= 0) {
      // Update existing
      result[existingIdx] = {
        ...result[existingIdx],
        ...partialSection,
      } as AnalysisValue;
    } else {
      // Add new (only if it has required fields)
      if (partialSection.kind && partialSection.value !== undefined) {
        result.push(partialSection as AnalysisValue);
      }
    }
  }

  return result;
}

export type AnalysisStatus = "idle" | "running" | "completed" | "error";

export interface AnalysisState {
  status: AnalysisStatus;
  phase: string;
  message: string;
  result: GodPromptOutput | null;
  runId: number | null;
  error: string | null;
}

interface UseDynamicAnalysisReturn {
  state: AnalysisState;
  startAnalysis: (additionalInstructions?: string) => Promise<void>;
  abort: () => void;
}

export function useDynamicAnalysis(videoId: string): UseDynamicAnalysisReturn {
  const [state, setState] = useState<AnalysisState>({
    status: "idle",
    phase: "",
    message: "",
    result: null,
    runId: null,
    error: null,
  });

  const abortControllerRef = useRef<AbortController | null>(null);

  const startAnalysis = useCallback(
    async (additionalInstructions?: string) => {
      // Abort any existing analysis
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      abortControllerRef.current = new AbortController();

      setState({
        status: "running",
        phase: "starting",
        message: "Starting analysis...",
        result: EMPTY_GOD_PROMPT_OUTPUT,
        runId: null,
        error: null,
      });

      try {
        const response = await fetch(`/api/video/${videoId}/analyze`, {
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
                const event: AnalysisStreamEvent = JSON.parse(line.slice(6));

                if (event.type === "progress") {
                  setState((prev) => ({
                    ...prev,
                    phase: event.phase,
                    message: event.message,
                  }));
                } else if (event.type === "partial") {
                  setState((prev) => ({
                    ...prev,
                    result: mergePartialResult(prev.result, event.data),
                  }));
                } else if (event.type === "result") {
                  setState((prev) => ({
                    ...prev,
                    result: event.data,
                  }));
                } else if (event.type === "complete") {
                  setState((prev) => ({
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
                if (parseError instanceof SyntaxError) {
                  // Ignore malformed SSE lines
                } else {
                  throw parseError;
                }
              }
            }
          }
        }
      } catch (err) {
        // Ignore abort errors
        if (err instanceof Error && err.name === "AbortError") {
          return;
        }

        const errorMessage =
          err instanceof Error ? err.message : "Analysis failed";

        setState((prev) => ({
          ...prev,
          status: "error",
          error: errorMessage,
        }));
      }
    },
    [videoId],
  );

  const abort = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  return {
    state,
    startAnalysis,
    abort,
  };
}
