"use client";

import { Check, Copy, ExternalLink } from "lucide-react";
import Image from "next/image";
import { createParser, useQueryState } from "nuqs";
import {
  useCallback,
  useEffect,
  useEffectEvent,
  useMemo,
  useState,
} from "react";
import { Streamdown } from "streamdown";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  analysisToMarkdown,
  formatSectionTitle,
  sectionToMarkdown,
} from "@/lib/analysis-format";
import { consumeSSE } from "@/lib/sse";
import { isRecord } from "@/lib/type-utils";
import type { AnalysisStreamEvent } from "@/workflows/steps/transcript-analysis";

interface AnalysisPanelProps {
  videoId: string;
  title: string;
  channelName: string;
}

const parseAsSectionId = createParser<string>({
  parse: (value) => (value ? value : null),
  serialize: (value) => value ?? "",
});

export function AnalysisPanel({
  videoId,
  title,
  channelName,
}: AnalysisPanelProps) {
  const [activeSection, setActiveSection] = useQueryState(
    "section",
    parseAsSectionId,
  );
  const [copied, setCopied] = useState(false);
  const [copiedSection, setCopiedSection] = useState<string | null>(null);
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
        const response = await fetch(`/api/video/${videoId}/analysis`, {
          signal: controller.signal,
        });

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
  }, [videoId]);

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

  const handleCopySection = async (title: string, content: unknown) => {
    const markdown = sectionToMarkdown(title, content);

    try {
      await navigator.clipboard.writeText(markdown);
      setCopiedSection(title);
      setTimeout(() => setCopiedSection(null), 2000);
    } catch (err) {
      console.error("Failed to copy section:", err);
    }
  };

  const hasContent = Object.keys(analysis).length > 0;
  const sections = useMemo(
    () =>
      Object.keys(analysis).map((key) => ({
        key,
        id: toSectionId(key),
        title: formatSectionTitle(key) || key,
      })),
    [analysis],
  );

  const scrollToSection = useCallback((sectionId: string) => {
    const sectionElement = document.getElementById(sectionId);
    if (!sectionElement) return;

    sectionElement.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const handleSectionClick = (sectionId: string) => {
    void setActiveSection(sectionId);
    scrollToSection(sectionId);
  };

  const scrollToActiveSection = useEffectEvent(
    (
      activeSection: string | null,
      scrollToSection: (sectionId: string) => void,
    ) => {
      if (!activeSection) return;
      const hasSection = sections.some(
        (section) => section.id === activeSection,
      );
      if (!hasSection) return;

      scrollToSection(activeSection);
    },
  );

  // biome-ignore lint/correctness/useExhaustiveDependencies: scrollToActiveSection is an effect event
  useEffect(() => {
    scrollToActiveSection(activeSection, scrollToSection);
  }, [activeSection, scrollToSection]);

  return (
    <div className="space-y-4">
      {statusMessage ? (
        <p className="text-sm text-muted-foreground">{statusMessage}</p>
      ) : null}

      {errorMessage ? (
        <p className="text-sm text-destructive">{errorMessage}</p>
      ) : null}

      {status === "loading" && !statusMessage ? (
        <p className="text-sm text-muted-foreground">Loading analysis...</p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
        <AnalysisSidebar
          sections={sections}
          activeSection={activeSection ?? undefined}
          onSectionClick={handleSectionClick}
          videoId={videoId}
          title={title}
          channelName={channelName}
          onCopyMarkdown={handleCopyMarkdown}
          copyDisabled={!hasContent}
          copied={copied}
        />

        <div className="space-y-4">
          {hasContent ? (
            Object.entries(analysis).map(([key, value]) => (
              <Section
                key={key}
                title={key}
                content={value}
                onCopy={() => handleCopySection(key, value)}
                copied={copiedSection === key}
              />
            ))
          ) : status === "ready" && !errorMessage ? (
            <p className="text-muted-foreground italic">
              No analysis available.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Sub-components
// ============================================================================

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

function Section({
  title,
  content,
  onCopy,
  copied,
}: {
  title: string;
  content: unknown;
  onCopy: () => void;
  copied: boolean;
}) {
  const key = title;
  const sectionId = toSectionId(title);
  const formattedTitle = formatSectionTitle(title) || title;

  return (
    <section id={sectionId} className="scroll-mt-24">
      <Card key={key}>
        <CardHeader>
          <SectionHeader
            title={formattedTitle}
            onCopy={onCopy}
            copied={copied}
          />
        </CardHeader>

        <CardContent>
          <SectionContent content={content} />
        </CardContent>
      </Card>
    </section>
  );
}

function SectionHeader({
  title,
  onCopy,
  copied,
}: {
  title: string;
  onCopy: () => void;
  copied: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <CardTitle className="text-base">{title}</CardTitle>
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={onCopy}
        className="gap-2 shrink-0"
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
    </div>
  );
}

function ObjectSection({ data }: { data: Record<string, unknown> }) {
  return (
    <dl className="divide-y divide-border/60">
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
            <dt className="text-sm/6 font-medium text-foreground">{key}</dt>
            <dd className="mt-1 text-sm/6 text-muted-foreground sm:col-span-2 sm:mt-0">
              <Streamdown>{markdown}</Streamdown>
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

function AnalysisSidebar({
  sections,
  activeSection,
  onSectionClick,
  videoId,
  title,
  channelName,
  onCopyMarkdown,
  copyDisabled,
  copied,
}: {
  sections: Array<{ id: string; title: string }>;
  activeSection?: string;
  onSectionClick: (sectionId: string) => void;
  videoId: string;
  title: string;
  channelName: string;
  onCopyMarkdown: () => void;
  copyDisabled: boolean;
  copied: boolean;
}) {
  return (
    <aside className="hidden lg:block sticky top-6 self-start">
      <div className="space-y-6">
        <VideoInfoCard
          videoId={videoId}
          title={title}
          channelName={channelName}
          onCopyMarkdown={onCopyMarkdown}
          copyDisabled={copyDisabled}
          copied={copied}
        />

        <div className="space-y-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70 px-1">
            Sections
          </p>
          {sections.length === 0 ? (
            <p className="text-sm text-muted-foreground px-1">
              Waiting for sections…
            </p>
          ) : (
            <nav className="space-y-1">
              {sections.map((section) => {
                const isActive = section.id === activeSection;

                return (
                  <button
                    key={section.id}
                    type="button"
                    onClick={() => onSectionClick(section.id)}
                    className={`w-full rounded-md px-2 py-1.5 text-left text-sm transition hover:bg-muted ${
                      isActive
                        ? "bg-muted text-foreground font-medium"
                        : "text-muted-foreground"
                    }`}
                  >
                    {section.title}
                  </button>
                );
              })}
            </nav>
          )}
        </div>
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
  videoId: string;
  title: string;
  channelName: string;
  onCopyMarkdown: () => void;
  copyDisabled: boolean;
  copied: boolean;
}) {
  const thumbnailUrl = `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`;

  return (
    <div className="space-y-3">
      <div className="group relative">
        <ThumbnailCell src={thumbnailUrl} alt={title} />
        <a
          href={`https://www.youtube.com/watch?v=${videoId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/20 rounded-md"
          aria-label="Watch Video"
        >
          <div className="opacity-0 transition-opacity group-hover:opacity-100 bg-background/90 p-1.5 rounded-full shadow-sm text-foreground">
            <ExternalLink className="h-4 w-4" />
          </div>
        </a>
      </div>

      <div className="space-y-1 px-1">
        <h3 className="font-bold text-sm line-clamp-2 leading-tight tracking-tight">
          {title}
        </h3>
        <p className="text-xs text-muted-foreground line-clamp-1">
          {channelName}
        </p>
      </div>

      <Button
        variant="outline"
        size="sm"
        onClick={onCopyMarkdown}
        className="w-full h-9 text-xs gap-2 shadow-none border-muted-foreground/20 hover:bg-muted"
        disabled={copyDisabled}
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
    <div className="aspect-video relative overflow-hidden rounded-md">
      <Image
        src={src || "/placeholder.svg?height=90&width=160"}
        alt={alt || "Video thumbnail"}
        fill
        sizes="(max-width: 240px) 100vw, 240px"
        className="object-cover"
        unoptimized
      />
    </div>
  );
}

function toSectionId(title: string) {
  return `analysis-${title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")}`;
}
