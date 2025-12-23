"use client";

import { Check, Copy, Sparkles, Stars } from "lucide-react";
import { useState } from "react";
import { Streamdown } from "streamdown";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useCopyWithFeedback } from "@/hooks/use-copy-with-feedback";
import { useStreamingFetch } from "@/lib/use-streaming-fetch";

interface SuperAnalysisPanelProps {
  videoId: string;
  title: string;
  channelName: string;
}

export function SuperAnalysisPanel({ videoId }: SuperAnalysisPanelProps) {
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
                {status === "error" ? "Retry Analysis" : "Start Super Analysis"}
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
