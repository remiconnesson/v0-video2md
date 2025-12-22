import { useCopyToClipboard } from "@uidotdev/usehooks";
import { useEffect, useState } from "react";

/**
 * Hook that wraps useCopyToClipboard with auto-resetting feedback state.
 * The `copied` state is automatically reset to false after 2 seconds.
 *
 * @returns A tuple containing:
 *  - copied: boolean indicating if content was recently copied
 *  - copy: function to copy text to clipboard and trigger feedback
 */
export function useCopyWithFeedback() {
  const [_copiedText, copyToClipboard] = useCopyToClipboard();
  const [copied, setCopied] = useState(false);

  // Reset copied state after 2 seconds
  useEffect(() => {
    if (copied) {
      const timer = setTimeout(() => {
        setCopied(false);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [copied]);

  const copy = (text: string) => {
    copyToClipboard(text);
    setCopied(true);
  };

  return [copied, copy] as const;
}
