"use client";

import { Sparkles } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

interface AnalyzeLinkButtonProps {
  youtubeId: string;
}

/**
 * Button to link from video page to dynamic analysis page.
 * Add this to the VideoHeader component or VideoContentView.
 */
export function AnalyzeLinkButton({ youtubeId }: AnalyzeLinkButtonProps) {
  return (
    <Link href={`/video/youtube/${youtubeId}/analyze`}>
      <Button variant="outline" className="gap-2">
        <Sparkles className="h-4 w-4" />
        Analyze
      </Button>
    </Link>
  );
}
