"use client";

import { useCopyToClipboard } from "@uidotdev/usehooks";
import {
  Check,
  Copy,
  ExternalLink,
  Image as ImageIcon,
  Sparkles,
  Stars,
} from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import { Streamdown } from "streamdown";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useStreamingFetch } from "@/lib/use-streaming-fetch";

// Mobile-only header with video info for super analysis
function MobileSuperAnalysisHeader({
  videoId,
  title,
  channelName,
  onCopyMarkdown,
  copyDisabled,
  copied,
}: {
  videoId?: string;
  title?: string;
  channelName?: string;
  onCopyMarkdown?: () => void;
  copyDisabled?: boolean;
  copied?: boolean;
}) {
  const thumbnailUrl = videoId
    ? `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`
    : undefined;

  return (
    <div className="lg:hidden">
      {/* Compact video info card for mobile */}
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
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                asChild
              >
                <a
                  href={`https://www.youtube.com/watch?v=${videoId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="h-3 w-3" />
                </a>
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

interface SuperAnalysisPanelProps {
  videoId: string;
  title: string;
  channelName: string;
}

export function SuperAnalysisPanel({
  videoId,
  title,
  channelName,
}: SuperAnalysisPanelProps) {
  const [copiedText, copyToClipboard] = useCopyToClipboard();
  const [triggerCount, setTriggerCount] = useState(0);

  const url =
    triggerCount > 0
      ? `/api/video/${videoId}/super-analysis?trigger=true`
      : `/api/video/${videoId}/super-analysis`;

  const {
    status,
    data: analysis,
    error: errorMessage,
    statusMessage,
  } = useStreamingFetch<string>(
    url,
    {
      initialData: "",
      accumulatePartial: true,
      onStatusMessage: (message) => {
        // Custom status message logic for super analysis
        if (triggerCount > 0 && message === "Fetching...") {
          return "Starting super analysis...";
        }
        if (message === "Generating...") {
          return "Generating comprehensive analysis...";
        }
        return message;
      },
    },
    [url],
  );

  const handleStartAnalysis = () => {
    setTriggerCount((prev) => prev + 1);
  };

  const handleCopyMarkdown = () => {
    copyToClipboard(analysis || "");
  };

  const hasContent = (analysis || "").trim().length > 0;

  return (
    <div className="space-y-4">
      {/* Mobile video info header */}
      <MobileSuperAnalysisHeader
        videoId={videoId}
        title={title}
        channelName={channelName}
        onCopyMarkdown={handleCopyMarkdown}
        copyDisabled={!hasContent}
        copied={Boolean(copiedText)}
      />

      <div className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
        <SuperAnalysisSidebar
          videoId={videoId}
          title={title}
          channelName={channelName}
          onCopyMarkdown={handleCopyMarkdown}
          copyDisabled={!hasContent}
          copied={Boolean(copiedText)}
        />

        <div className="flex flex-col gap-4">
          {errorMessage ? (
            <div className="min-h-5 flex items-center">
              <p className="text-sm text-destructive animate-in fade-in slide-in-from-top-1 duration-200">
                {errorMessage}
              </p>
            </div>
          ) : null}

          {status === "loading" || status === "streaming" ? (
            <div className="p-3 bg-muted/30 rounded-md text-sm">
              <span className="font-medium">Status:</span> {statusMessage}
            </div>
          ) : null}

          <div className="space-y-6">
            {hasContent ? (
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                  <CardTitle className="text-xl md:text-2xl font-bold tracking-tight">
                    Super Analysis
                  </CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleCopyMarkdown}
                    aria-label="Copy super analysis markdown"
                    className="gap-2 shrink-0 text-muted-foreground hover:text-foreground"
                  >
                    {copiedText ? (
                      <>
                        <Check className="h-4 w-4" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4" />
                        Copy
                      </>
                    )}
                  </Button>
                </CardHeader>
                <CardContent>
                  <SectionContent content={analysis} />
                </CardContent>
              </Card>
            ) : status === "loading" || status === "streaming" ? (
              <div className="space-y-6">
                {[1, 2, 3].map((i) => (
                  <Card key={i} className="animate-pulse border-muted/30">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                      <Skeleton className="h-8 w-24 rounded-lg" />
                      <div className="flex items-center gap-2 text-muted-foreground/40">
                        <Copy className="h-4 w-4" />
                        <span className="text-xs font-medium uppercase tracking-wider">
                          Copy
                        </span>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-[96%]" />
                        <Skeleton className="h-4 w-[92%]" />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : status === "idle" || status === "error" ? (
              <Card className="border-dashed border-2 flex flex-col items-center justify-center p-6 md:p-12 text-center">
                <div className="bg-primary/10 p-3 md:p-4 rounded-full mb-3 md:mb-4">
                  <Stars className="h-6 w-6 md:h-8 md:w-8 text-primary" />
                </div>
                <CardTitle className="mb-2 text-lg md:text-xl">
                  {status === "error"
                    ? "Analysis failed"
                    : "Super Analysis Ready"}
                </CardTitle>
                <p className="text-sm md:text-base text-muted-foreground mb-4 md:mb-6 max-w-sm">
                  {status === "error"
                    ? "There was an error generating the comprehensive analysis. You can try again."
                    : "Generate a comprehensive analysis combining transcripts and slide content."}
                </p>
                <Button
                  size="default"
                  onClick={handleStartAnalysis}
                  className="gap-2"
                >
                  <Sparkles className="h-4 w-4" />
                  {status === "error"
                    ? "Retry Analysis"
                    : "Start Super Analysis"}
                </Button>
              </Card>
            ) : status === "ready" && !errorMessage ? (
              <p className="text-muted-foreground italic">
                No super analysis available.
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function SectionContent({ content }: { content: unknown }): React.ReactNode {
  if (content === null || content === undefined || content === "") {
    return <p className="text-muted-foreground italic">No content</p>;
  }

  if (typeof content === "string") {
    return (
      <div className="prose text-sm dark:prose-invert max-w-none prose-p:leading-relaxed prose-p:text-muted-foreground/90">
        <Streamdown>{content || ""}</Streamdown>
      </div>
    );
  }

  return <p>{String(content)}</p>;
}

function SuperAnalysisSidebar({
  videoId,
  title,
  channelName,
  onCopyMarkdown,
  copyDisabled,
  copied,
}: {
  videoId?: string;
  title?: string;
  channelName?: string;
  onCopyMarkdown?: () => void;
  copyDisabled?: boolean;
  copied?: boolean;
}) {
  return (
    <aside className="hidden lg:flex flex-col sticky top-6 self-start h-[calc(100vh-3.5rem)] min-w-0 group/sidebar">
      <div className="shrink-0 mb-6 pr-2">
        <VideoInfoCard
          videoId={videoId}
          title={title}
          channelName={channelName}
          onCopyMarkdown={onCopyMarkdown}
          copyDisabled={copyDisabled}
          copied={copied}
        />
      </div>
    </aside>
  );
}

function VideoInfoCard({
  videoId,
  title,
  channelName,
  onCopyMarkdown,
  copyDisabled,
  copied,
}: {
  videoId?: string;
  title?: string;
  channelName?: string;
  onCopyMarkdown?: () => void;
  copyDisabled?: boolean;
  copied?: boolean;
}) {
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
