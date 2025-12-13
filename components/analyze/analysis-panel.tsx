"use client";

import { Check, Copy } from "lucide-react";
import { useQueryState } from "nuqs";
import { useEffect, useMemo, useState } from "react";
import { Streamdown } from "streamdown";
import {
  VERSION_NOT_PROVIDED_SENTINEL,
  VERSION_SEARCH_PARAM_KEY,
  versionSearchParamParsers,
} from "@/app/video/youtube/[youtubeId]/analyze/searchParams";
import type { AnalysisStreamEvent } from "@/app/workflows/steps/transcript-analysis";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { analysisToMarkdown, formatSectionTitle } from "@/lib/analysis-format";
import { consumeSSE } from "@/lib/sse";
import { isRecord } from "@/lib/type-utils";
import { getVersion, type Versions } from "@/lib/versions-utils";

interface AnalysisPanelProps {
  videoId: string;
  versions: Versions;
}

export function AnalysisPanel({ videoId, versions }: AnalysisPanelProps) {
  const [version] = useQueryState(
    VERSION_SEARCH_PARAM_KEY,
    versionSearchParamParsers.version,
  );

  const displayedVersion = useMemo(
    () => getVersion(version, versions, VERSION_NOT_PROVIDED_SENTINEL),
    [version, versions],
  );

  const [copied, setCopied] = useState(false);
  const [analysis, setAnalysis] = useState<Record<string, unknown>>({});
  const [status, setStatus] = useState<
    "idle" | "loading" | "streaming" | "ready" | "error"
  >("idle");
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function fetchAnalysis() {
      setStatus("loading");
      setStatusMessage("Fetching analysis...");
      setErrorMessage(null);
      setAnalysis({});

      try {
        const response = await fetch(
          `/api/video/${videoId}/analysis/${displayedVersion}`,
          { signal: controller.signal },
        );

        if (!response.ok) {
          const errorData = await response
            .json()
            .catch(() => ({ error: response.statusText }));
          throw new Error(errorData.error || "Failed to load analysis");
        }

        const contentType = response.headers.get("content-type") ?? "";

        if (contentType.includes("text/event-stream")) {
          setStatus("streaming");
          setStatusMessage("Generating analysis...");

          await consumeSSE<AnalysisStreamEvent>(
            response,
            {
              progress: (event) => {
                setStatus("streaming");
                if (event.message) {
                  setStatusMessage(event.message);
                } else if (event.phase) {
                  setStatusMessage(event.phase);
                }
              },
              partial: (event) => {
                const partialData = event.data;
                if (!isRecord(partialData)) return;

                setAnalysis((prev) => ({ ...prev, ...partialData }));
                setStatus("streaming");
              },
              result: (event) => {
                if (isRecord(event.data)) {
                  setAnalysis(event.data);
                }
                setStatus("ready");
                setStatusMessage("");
              },
              complete: () => {
                setStatus((prev) => (prev === "error" ? prev : "ready"));
                setStatusMessage("");
              },
              error: (event) => {
                setErrorMessage(event.message);
                setStatus("error");
                setStatusMessage("");
              },
            },
            {
              onError: (streamError) => {
                if (controller.signal.aborted) return;

                const message =
                  streamError instanceof Error
                    ? streamError.message
                    : "Failed to stream analysis";
                setErrorMessage(message);
                setStatus("error");
                setStatusMessage("");
              },
            },
          );
        } else {
          const data = await response.json();
          const result =
            isRecord(data) && isRecord(data.result) ? data.result : {};

          setAnalysis(result);
          setStatus("ready");
          setStatusMessage("");
        }
      } catch (error) {
        if (controller.signal.aborted) return;

        const message =
          error instanceof Error ? error.message : "Failed to load analysis";
        setErrorMessage(message);
        setStatus("error");
        setStatusMessage("");
      }
    }

    void fetchAnalysis();

    return () => {
      controller.abort();
    };
  }, [videoId, displayedVersion]);

  const handleCopyMarkdown = async () => {
    const markdown = analysisToMarkdown(analysis);

    try {
      await navigator.clipboard.writeText(markdown);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const hasContent = Object.keys(analysis).length > 0;

  return (
    <div className="space-y-4">
      <CopyButton
        copied={copied}
        onCopy={handleCopyMarkdown}
        disabled={!hasContent}
      />

      {statusMessage ? (
        <p className="text-sm text-muted-foreground">{statusMessage}</p>
      ) : null}

      {errorMessage ? (
        <p className="text-sm text-destructive">{errorMessage}</p>
      ) : null}

      {hasContent ? (
        Object.entries(analysis).map(([key, value]) => (
          <Section key={key} title={key} content={value} />
        ))
      ) : status === "ready" && !errorMessage ? (
        <p className="text-muted-foreground italic">No analysis available.</p>
      ) : null}
    </div>
  );
}

// ============================================================================
// Sub-components
// ============================================================================

function CopyButton({
  copied,
  onCopy,
  disabled,
}: {
  copied: boolean;
  onCopy: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex justify-end">
      <Button
        variant="outline"
        size="sm"
        onClick={onCopy}
        className="gap-2"
        disabled={disabled}
      >
        {copied ? (
          <>
            <Check className="h-4 w-4" />
            Copied!
          </>
        ) : (
          <>
            <Copy className="h-4 w-4" />
            Copy Markdown
          </>
        )}
      </Button>
    </div>
  );
}

function SectionContent({ content }: { content: unknown }): React.ReactNode {
  if (content === null || content === undefined || content === "") {
    return <p className="text-muted-foreground italic">No content</p>;
  }

  if (typeof content === "string") {
    return (
      <div className="prose prose-sm dark:prose-invert max-w-none">
        <Streamdown>{content || ""}</Streamdown>
      </div>
    );
  }

  if (Array.isArray(content)) {
    if (content.length === 0) {
      return <p className="text-muted-foreground italic">No items</p>;
    }
    return (
      <Streamdown>
        {content
          .map((item) =>
            typeof item === "string"
              ? // Check if already starts with - * or numbered list (1. 2. etc.) or 1), 2), if so, don't add a -
                item.trim().match(/^\s*[-*]\s+|^\s*\d+\.\s+|^\s*\d+\)\s+/)
                ? item
                : `- ${item}`
              : `\n\`\`\`json\n${JSON.stringify(item, null, 2)}\n\`\`\`\n`,
          )
          .join("\n")}
      </Streamdown>
    );
  }

  if (isRecord(content)) {
    return <ObjectSection data={content} />;
  }

  return <p>{String(content)}</p>;
}

// ============================================================================
// Section Components
// ============================================================================

function Section({ title, content }: { title: string; content: unknown }) {
  const key = title;
  const formattedTitle = formatSectionTitle(title) || title;

  return (
    <Card key={key}>
      <CardHeader>
        <SectionHeader title={formattedTitle} sectionKey={key} />
      </CardHeader>

      <CardContent>
        <SectionContent content={content} />
      </CardContent>
    </Card>
  );
}

function SectionHeader({
  title,
}: {
  title: string;
  description?: string;
  sectionKey: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <CardTitle className="text-base">{title}</CardTitle>
      </div>
    </div>
  );
}

export function ObjectSection({ data }: { data: Record<string, unknown> }) {
  return (
    <dl className="divide-y divide-gray-100">
      {Object.entries(data).map(([key, value]) => {
        const markdown =
          typeof value === "string"
            ? value || ""
            : `\`\`\`json\n${
                JSON.stringify(value, null, 2) ?? String(value)
              }\n\`\`\``;

        return (
          <div
            key={key}
            className="px-4 py-6 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0"
          >
            <dt className="text-sm/6 font-medium text-gray-900">{key}</dt>
            <dd className="mt-1 text-sm/6 text-gray-700 sm:col-span-2 sm:mt-0">
              <Streamdown>{markdown}</Streamdown>
            </dd>
          </div>
        );
      })}
    </dl>
  );
}
