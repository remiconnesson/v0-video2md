"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { consumeSSE } from "./sse";

export type StreamingStatus =
  | "idle"
  | "loading"
  | "streaming"
  | "ready"
  | "error";

export interface UseSSEFetchOptions<TEvent, TResult> {
  /**
   * Called when progress events are received during streaming
   */
  onProgress?: (event: TEvent) => void;
  /**
   * Called when partial data events are received during streaming
   */
  onPartial?: (event: TEvent) => void;
  /**
   * Called when result events are received during streaming
   */
  onResult?: (event: TEvent) => void;
  /**
   * Called when the stream completes successfully
   */
  onComplete?: () => void;
  /**
   * Called when stream errors occur
   */
  onError?: (event: TEvent) => void;
  /**
   * Function to parse JSON responses (when not streaming)
   */
  parseJsonResponse: (data: unknown) => TResult;
  /**
   * Initial data value
   */
  initialData?: TResult | null;
  /**
   * Whether to accumulate partial data (true) or replace it (false)
   */
  accumulatePartial?: boolean;
}

export interface UseSSEFetchReturn<TResult> {
  status: StreamingStatus;
  data: TResult | null;
  error: string | null;
  refetch: () => void;
  reset: () => void;
}

/**
 * Generic hook for handling fetch operations that may return SSE streams or JSON responses.
 * Abstracts the common pattern of checking content-type and handling both streaming and non-streaming responses.
 */
export function useSSEFetch<TEvent extends { type: string }, TResult>(
  url: string | null,
  options: UseSSEFetchOptions<TEvent, TResult>,
  deps: React.DependencyList = [],
): UseSSEFetchReturn<TResult> {
  const {
    onProgress,
    onPartial,
    onResult,
    onComplete,
    onError,
    parseJsonResponse,
    initialData = null,
    accumulatePartial = false,
  } = options;

  const [status, setStatus] = useState<StreamingStatus>("idle");
  const [data, setData] = useState<TResult | null>(initialData);
  const [error, setError] = useState<string | null>(null);

  // Use refs to avoid stale closures in the effect
  const fetchControllerRef = useRef<AbortController | null>(null);

  const reset = useCallback(() => {
    setStatus("idle");
    setData(initialData);
    setError(null);
  }, [initialData]);

  const fetchData = useCallback(
    async (signal: AbortSignal) => {
      if (!url) return;

      setStatus("loading");
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

          await consumeSSE<TEvent>(
            response,
            {
              progress: (event: any) => {
                onProgress?.(event);
                setStatus("streaming");
              },
              partial: (event: any) => {
                if (accumulatePartial && onPartial) {
                  onPartial(event);
                } else if (onPartial) {
                  onPartial(event);
                  setStatus("streaming");
                }
              },
              result: (event: any) => {
                onResult?.(event);
                setStatus("ready");
              },
              complete: () => {
                onComplete?.();
                setStatus((prev) => (prev === "error" ? prev : "ready"));
              },
              error: (event: any) => {
                const errorMessage = event.message || "Stream error";
                onError?.(event);
                setError(errorMessage);
                setStatus("error");
              },
            } as any,
            {
              onError: (streamError) => {
                if (signal.aborted) return;

                const message =
                  streamError instanceof Error
                    ? streamError.message
                    : "Failed to stream data";
                setError(message);
                setStatus("error");
              },
            },
          );
        } else {
          // Handle non-streaming response
          const result = await response.json();
          const parsedData = parseJsonResponse(result);
          setData(parsedData);
          setStatus("ready");
        }
      } catch (error) {
        if (signal.aborted) return;

        const message =
          error instanceof Error ? error.message : "Failed to load data";
        setError(message);
        setStatus("error");
      }
    },
    [
      url,
      initialData,
      onProgress,
      onPartial,
      onResult,
      onComplete,
      onError,
      parseJsonResponse,
      accumulatePartial,
    ],
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
    refetch,
    reset,
  };
}