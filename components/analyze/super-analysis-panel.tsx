"use client";

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
import { useCopyWithFeedback } from "@/hooks/use-copy-with-feedback";
import { useStreamingFetch } from "@/lib/use-streaming-fetch";
import { VideoInfoCard } from "./video-info-card";

// Mobile-only header with video info for super analysis
function _MobileSuperAnalysisHeader({
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
      <div className="flex gap-4 items-start">
        <div className="w-28 shrink-0 shadow-sm rounded-md overflow-hidden">
          <div className="aspect-video relative bg-muted">
            {thumbnailUrl ? (
              <Image
                src={thumbnailUrl}
                alt={title || "Video thumbnail"}
                fill
                sizes="112px"
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
        <div className="flex-1 min-w-0 py-0.5">
          <h3 className="font-bold text-base leading-tight mb-1.5 line-clamp-2">
            {title || "Video Analysis"}
          </h3>
          <p className="text-sm text-muted-foreground font-medium mb-3">
            {channelName || "Unknown Channel"}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onCopyMarkdown}
              className="h-8 text-xs gap-1.5 px-3"
              disabled={copyDisabled || !onCopyMarkdown}
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  Copy
                </>
              )}
            </Button>
            {videoId && (
              <Button
                variant="outline"
                size="sm"
                className="h-8 w-8 p-0"
                asChild
              >
                <a
                  href={`https://www.youtube.com/watch?v=${videoId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
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
  title: _title,
  channelName: _channelName,
}: SuperAnalysisPanelProps) {
  const [copied, copy] = useCopyWithFeedback();
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
        if (triggerCount > 0 && message === "Fetching...") {
          console.log("Starting super analysis...");
        } else if (message === "Generating...") {
          console.log("Generating comprehensive analysis...");
        } else {
          console.log(message);
        }
      },
    },
    [url],
  );

  const handleStartAnalysis = () => {
    setTriggerCount((prev) => prev + 1);
  };

  const handleCopyMarkdown = () => {
    copy(analysis || "");
  };

  const hasContent = (analysis || "").trim().length > 0;

  return (
    <div className="space-y-4">
      {/* Mobile video info header - Hidden as per user request */}
      {/* <MobileSuperAnalysisHeader
        videoId={videoId}
        onCopyMarkdown={handleCopyMarkdown}
        copyDisabled={!hasContent}
        copied={copied}
      /> */}

      <div className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
        <SuperAnalysisSidebar
          videoId={videoId}
          onCopyMarkdown={handleCopyMarkdown}
          copyDisabled={!hasContent}
          copied={copied}
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
                    {copied ? (
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
  onCopyMarkdown,
  copyDisabled,
  copied,
}: {
  videoId?: string;
  onCopyMarkdown?: () => void;
  copyDisabled?: boolean;
  copied?: boolean;
}) {
  return (
    <aside className="hidden lg:flex flex-col sticky top-6 self-start h-[calc(100vh-3.5rem)] min-w-0 group/sidebar">
      <div className="shrink-0 mb-6 pr-2">
        <VideoInfoCard
          videoId={videoId}
          onCopyMarkdown={onCopyMarkdown}
          copyDisabled={copyDisabled}
          copied={copied}
        />
      </div>
    </aside>
  );
}
