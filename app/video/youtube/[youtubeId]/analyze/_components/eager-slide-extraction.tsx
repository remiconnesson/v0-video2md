"use client";

import { useEffect, useRef } from "react";

/**
 * Fire-and-forget component that triggers slide extraction as soon as the
 * analyze layout mounts, instead of waiting for the user to navigate to
 * the slides-selection tab. The POST endpoint is idempotent — it returns
 * 409 if extraction is already completed or in progress.
 */
export function EagerSlideExtraction({ videoId }: { videoId: string }) {
  const firedRef = useRef(false);

  useEffect(() => {
    if (firedRef.current) return;
    firedRef.current = true;

    fetch(`/api/video/${videoId}/slides`, { method: "POST" }).catch(() => {
      // Silently ignore — the slides panel will handle errors when the user
      // navigates to it. This is purely a best-effort early start.
    });
  }, [videoId]);

  return null;
}
