import { Check, Copy, ExternalLink, Image as ImageIcon } from "lucide-react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

interface MobileVideoInfoCardProps {
  videoId?: string;
  title?: string;
  channelName?: string;
  onCopyMarkdown?: () => void;
  copyDisabled?: boolean;
  copied?: boolean;
}

/**
 * Shared mobile video info card component used in analysis and super-analysis panels.
 * Displays video thumbnail, title, channel name, and action buttons (copy and YouTube link).
 */
export function MobileVideoInfoCard({
  videoId,
  title,
  channelName,
  onCopyMarkdown,
  copyDisabled,
  copied,
}: MobileVideoInfoCardProps) {
  const thumbnailUrl = videoId
    ? `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`
    : undefined;

  return (
    <div className="flex gap-3 items-start">
      <div className="w-24 shrink-0">
        <div className="aspect-video relative overflow-hidden rounded-md bg-muted">
          {thumbnailUrl ? (
            <Image
              src={thumbnailUrl}
              alt={title || "Video thumbnail"}
              fill
              sizes="96px"
              className="object-cover"
              unoptimized
            />
          ) : (
            <div className="flex items-center justify-center h-full">
              <ImageIcon className="h-6 w-6 text-muted-foreground/20" />
            </div>
          )}
        </div>
      </div>
      <div className="flex-1 min-w-0">
        {title ? (
          <h3 className="font-bold text-sm line-clamp-2 leading-tight">
            {title}
          </h3>
        ) : (
          <Skeleton className="h-4 w-full" />
        )}
        {channelName ? (
          <p className="text-xs text-muted-foreground mt-1">{channelName}</p>
        ) : (
          <Skeleton className="h-3 w-1/2 mt-1" />
        )}
        <div className="flex gap-2 mt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onCopyMarkdown}
            className="h-7 text-xs gap-1.5"
            disabled={copyDisabled || !onCopyMarkdown}
          >
            {copied ? (
              <>
                <Check className="h-3 w-3" />
                Copied
              </>
            ) : (
              <>
                <Copy className="h-3 w-3" />
                Copy
              </>
            )}
          </Button>
          {videoId && (
            <Button variant="outline" size="sm" className="h-7 text-xs" asChild>
              <a
                href={`https://www.youtube.com/watch?v=${videoId}`}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Watch on YouTube"
              >
                <ExternalLink className="h-3 w-3" />
              </a>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
