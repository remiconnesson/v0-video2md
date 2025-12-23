"use client";

import { Check, Copy, ExternalLink, Image as ImageIcon } from "lucide-react";
import Image from "next/image";
import { Button } from "@/components/ui/button";

interface VideoInfoCardProps {
  videoId?: string;
  title?: string;
  channelName?: string;
  onCopyMarkdown?: () => void;
  copyDisabled?: boolean;
  copied?: boolean;
}

export function VideoInfoCard({
  videoId,
  title,
  channelName,
  onCopyMarkdown,
  copyDisabled,
  copied,
}: VideoInfoCardProps) {
  const thumbnailUrl = videoId
    ? `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`
    : undefined;

  return (
    <div className="space-y-3">
      <div className="group relative">
        <ThumbnailCell src={thumbnailUrl} alt={title} />
        {videoId && (
          <a
            href={`https://www.youtube.com/watch?v=${videoId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors cursor-pointer group-hover:bg-black/20 rounded-md"
            aria-label="Watch Video"
          >
            <div className="opacity-0 transition-opacity group-hover:opacity-100 bg-background/90 p-1.5 rounded-full shadow-sm text-foreground">
              <ExternalLink className="h-4 w-4" />
            </div>
          </a>
        )}
      </div>

      <div className="space-y-1 px-1">
        {title ? (
          <h3 className="font-bold text-sm line-clamp-2 leading-tight tracking-tight">
            {title}
          </h3>
        ) : (
          <div className="h-4 w-full animate-pulse rounded bg-muted/50" />
        )}
        {channelName ? (
          <p className="text-xs text-muted-foreground line-clamp-1">
            {channelName}
          </p>
        ) : (
          <div className="h-3 w-1/2 animate-pulse rounded bg-muted/50" />
        )}
      </div>

      <Button
        variant="outline"
        size="sm"
        onClick={onCopyMarkdown}
        className="w-full h-9 text-xs gap-2 shadow-none border-muted-foreground/20 hover:bg-muted"
        disabled={copyDisabled || !onCopyMarkdown}
      >
        {copied ? (
          <>
            <Check className="h-3.5 w-3.5" />
            Copied!
          </>
        ) : (
          <>
            <Copy className="h-3.5 w-3.5" />
            Copy Markdown
          </>
        )}
      </Button>
    </div>
  );
}

function ThumbnailCell({ src, alt }: { src?: string; alt?: string }) {
  return (
    <div className="aspect-video relative overflow-hidden rounded-md bg-muted flex items-center justify-center">
      {src ? (
        <Image
          src={src}
          alt={alt || "Video thumbnail"}
          fill
          sizes="(max-width: 240px) 100vw, 240px"
          className="object-cover"
          unoptimized
        />
      ) : (
        <ImageIcon className="h-8 w-8 text-muted-foreground/20" />
      )}
    </div>
  );
}
