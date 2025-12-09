import { useCallback, useRef } from "react";
import type { SSEBaseEvent, SSEHandlerMap } from "@/lib/sse";

export interface UseSSEStreamReturn<T extends SSEBaseEvent> {
  start: (
    url: string,
    handlers: SSEHandlerMap<T>,
    options?: { body?: unknown; headers?: Record<string, string> },
  ) => Promise<void>;
  abort: () => void;
}

export function useSSEStream<T extends SSEBaseEvent>(): UseSSEStreamReturn<T> {
  const abortControllerRef = useRef<AbortController | null>(null);

  const start = useCallback(
    async (
      url: string,
      handlers: SSEHandlerMap<T>,
      options: { body?: unknown; headers?: Record<string, string> } = {},
    ): Promise<void> => {
      // Abort any existing stream
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      abortControllerRef.current = new AbortController();

      const { body, headers = {} } = options;

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...headers,
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      // Import consumeSSE dynamically to avoid circular imports
      const { consumeSSE } = await import("@/lib/sse");

      await consumeSSE<T>(response, handlers);
    },
    [],
  );

  const abort = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  return { start, abort };
}
