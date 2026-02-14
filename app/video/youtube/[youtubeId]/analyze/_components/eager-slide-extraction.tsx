"use client";

import { useEffect, useRef } from "react";

/**
 * Fire-and-forget component that triggers slide extraction as soon as the
 * analyze layout mounts, instead of waiting for the user to navigate to
 * the slides-selection tab. The POST endpoint is idempotent — it returns
 * 409 if extraction is already completed or in progress.
 */
export function EagerSlideExtraction({ videoId }: { videoId: string }) {
  const firedForRef = useRef<string | null>(null);

  useEffect(() => {
    if (firedForRef.current === videoId) return;
    firedForRef.current = videoId;

    const controller = new AbortController();

    fetch(`/api/video/${videoId}/slides`, {
      method: "POST",
      signal: controller.signal,
    })
      .then(() => {
        // Close the connection immediately since we only care about
        // triggering the workflow, not consuming the SSE stream.
        controller.abort();
      })
      .catch(() => {
        // Silently ignore — the slides panel will handle errors when the user
        // navigates to it. This is purely a best-effort early start.
      });

    return () => controller.abort();
  }, [videoId]);

  return null;
}
