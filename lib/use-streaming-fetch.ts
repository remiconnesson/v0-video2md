"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { consumeSSE } from "./sse";

export type StreamingStatus =
  | "idle"
  | "loading"
  | "streaming"
  | "ready"
  | "error";

export type StreamingEvent<T> =
  | { type: "progress"; phase: string; message: string }
  | { type: "partial"; data: T }
  | { type: "result"; data: T }
  | { type: "complete"; runId: number }
  | { type: "error"; message: string };

export interface UseStreamingFetchOptions<T> {
  /** Initial data value */
  initialData?: T | null;
  /** Whether to accumulate partial data (true) or replace it (false) */
  accumulatePartial?: boolean;
  /** Custom status message setter */
  onStatusMessage?: (message: string) => void;
}

export interface UseStreamingFetchReturn<T> {
  status: StreamingStatus;
  data: T | null;
  error: string | null;
  statusMessage: string;
  refetch: () => void;
  reset: () => void;
}

/**
 * Generic hook for handling streaming fetch operations with SSE.
 * Abstracts the common streaming state machine used in analysis panels.
 */
export function useStreamingFetch<T>(
  url: string | null,
  options: UseStreamingFetchOptions<T> = {},
  deps: React.DependencyList = [],
): UseStreamingFetchReturn<T> {
  const {
    initialData = null,
    accumulatePartial = false,
    onStatusMessage,
  } = options;

  const [status, setStatus] = useState<StreamingStatus>("idle");
  const [data, setData] = useState<T | null>(initialData);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>("");

  // Use refs to avoid stale closures in the effect
  const statusMessageRef = useRef<(message: string) => void>(setStatusMessage);
  statusMessageRef.current = onStatusMessage ?? setStatusMessage;

  const fetchControllerRef = useRef<AbortController | null>(null);

  const reset = useCallback(() => {
    setStatus("idle");
    setData(initialData);
    setError(null);
    statusMessageRef.current("");
  }, [initialData]);

  const fetchData = useCallback(
    async (signal: AbortSignal) => {
      if (!url) return;

      setStatus("loading");
      statusMessageRef.current("Fetching...");
      setError(null);
      setData(initialData);

      try {
        const response = await fetch(url, { signal });

        if (!response.ok) {
          const errorData = await response
            .json()
            .catch(() => ({ error: response.statusText }));
          throw new Error(errorData.error || "Failed to load data");
        }

        const contentType = response.headers.get("content-type") ?? "";

        if (contentType.includes("text/event-stream")) {
          setStatus("streaming");
          statusMessageRef.current("Generating...");

          await consumeSSE<StreamingEvent<T>>(
            response,
            {
              progress: (event) => {
                setStatus("streaming");
                if (event.message) {
                  statusMessageRef.current(event.message);
                } else if (event.phase) {
                  statusMessageRef.current(event.phase);
                }
              },
              partial: (event) => {
                if (
                  accumulatePartial &&
                  typeof data === "string" &&
                  typeof event.data === "string"
                ) {
                  setData((prev) => `${prev}${event.data}` as T);
                } else {
                  setData(event.data);
                }
                setStatus("streaming");
              },
              result: (event) => {
                setData(event.data);
                setStatus("ready");
                statusMessageRef.current("");
              },
              complete: () => {
                setStatus((prev) => (prev === "error" ? prev : "ready"));
                statusMessageRef.current("");
              },
              error: (event) => {
                setError(event.message);
                setStatus("error");
                statusMessageRef.current("");
              },
            },
            {
              onError: (streamError) => {
                if (signal.aborted) return;

                const message =
                  streamError instanceof Error
                    ? streamError.message
                    : "Failed to stream data";
                setError(message);
                setStatus("error");
                statusMessageRef.current("");
              },
            },
          );
        } else {
          // Handle non-streaming response
          const result = await response.json();

          // Special handling for status-based responses (like super analysis)
          if (result.status === "not_started") {
            setStatus("idle");
            statusMessageRef.current("");
            return;
          }

          setData(result.result ?? result);
          setStatus("ready");
          statusMessageRef.current("");
        }
      } catch (error) {
        if (signal.aborted) return;

        const message =
          error instanceof Error ? error.message : "Failed to load data";
        setError(message);
        setStatus("error");
        statusMessageRef.current("");
      }
    },
    [url, initialData, accumulatePartial, data],
  );

  const refetch = useCallback(() => {
    if (fetchControllerRef.current) {
      fetchControllerRef.current.abort();
    }
    const controller = new AbortController();
    fetchControllerRef.current = controller;
    void fetchData(controller.signal);
  }, [fetchData]);

  useEffect(() => {
    const controller = new AbortController();
    fetchControllerRef.current = controller;
    void fetchData(controller.signal);

    return () => {
      controller.abort();
    };
    // biome-ignore lint/correctness/useExhaustiveDependencies: deps is passed from caller
  }, deps);

  return {
    status,
    data,
    error,
    statusMessage,
    refetch,
    reset,
  };
}
