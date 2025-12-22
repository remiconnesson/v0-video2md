import { useState } from "react";
import { UI } from "@/lib/constants";

export function useCopyToClipboard(timeout = UI.COPY_FEEDBACK_DURATION_MS) {
  const [copied, setCopied] = useState(false);

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), timeout);
    } catch (err) {
      console.error("Failed to copy:", err);
      // Don't set copied to true if the copy failed
    }
  };

  return { copied, copy };
}
