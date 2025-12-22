"use client";

import {
  Check,
  ChevronDown,
  Copy,
  ExternalLink,
  Image as ImageIcon,
} from "lucide-react";
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
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  analysisToMarkdown,
  formatSectionTitle,
  sectionToMarkdown,
} from "@/lib/analysis-format";
import { isRecord } from "@/lib/type-utils";
import { useStreamingFetch } from "@/lib/use-streaming-fetch";
import { cn } from "@/lib/utils";

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

  const {
    status,
    data: analysis,
    error: errorMessage,
    statusMessage: _statusMessage,
  } = useStreamingFetch<Record<string, unknown>>(
    `/api/video/${videoId}/analysis`,
    {
      initialData: {},
    },
    [videoId],
  );

  const handleCopyMarkdown = async () => {
    const markdown = analysisToMarkdown(analysis || {});

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

  const hasContent = Object.keys(analysis || {}).length > 0;
  const sections = useMemo(
    () =>
      Object.keys(analysis || {}).map((key) => ({
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
      {/* Mobile video info and sections navigation */}
      <MobileAnalysisHeader
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

        <div className="flex flex-col gap-4">
          {errorMessage ? (
            <div className="min-h-5 flex items-center">
              <p className="text-sm text-destructive animate-in fade-in slide-in-from-top-1 duration-200">
                {errorMessage}
              </p>
            </div>
          ) : null}

          <div className="space-y-6">
            {hasContent ? (
              Object.entries(analysis || {}).map(([key, value]) => (
                <Section
                  key={key}
                  title={key}
                  content={value}
                  onCopy={() => handleCopySection(key, value)}
                  copied={copiedSection === key}
                />
              ))
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
            ) : status === "ready" && !errorMessage ? (
              <p className="text-muted-foreground italic">
                No analysis available.
              </p>
            ) : null}
          </div>
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
      <div className="prose text-sm dark:prose-invert max-w-none prose-p:leading-relaxed prose-p:text-muted-foreground/90">
        <Streamdown>{content || ""}</Streamdown>
      </div>
    );
  }

  if (Array.isArray(content)) {
    if (content.length === 0) {
      return <p className="text-muted-foreground italic text-sm">No items</p>;
    }
    return (
      <div className="prose text-sm dark:prose-invert max-w-none prose-p:leading-relaxed prose-p:text-muted-foreground/90">
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
      </div>
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
    <div className="flex items-start justify-between gap-2 md:gap-4">
      <div>
        <CardTitle className="text-xl md:text-2xl font-bold tracking-tight">
          {title}
        </CardTitle>
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={onCopy}
        aria-label={
          copied ? `Copied ${title} section` : `Copy ${title} section`
        }
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
    </div>
  );
}

function ObjectSection({ data }: { data: Record<string, unknown> }) {
  return (
    <div className="space-y-8 mt-2">
      {Object.entries(data).map(([key, value]) => {
        const formattedKey = formatSectionTitle(key);
        const markdown =
          typeof value === "string"
            ? value || ""
            : `\`\`\`json\n${
                JSON.stringify(value, null, 2) ?? String(value)
              }\n\`\`\``;

        return (
          <div key={key} className="relative flex flex-col gap-3 group">
            <div className="flex items-center gap-3">
              <dt className="text-[10px] font-black uppercase tracking-[0.15em] text-muted-foreground/50 select-text flex-none break-all">
                {formattedKey}
              </dt>
              <div className="h-px flex-1 bg-border/40 group-hover:bg-primary/20 transition-colors" />
            </div>
            <dd className="pl-4 border-l-2 border-border/20 group-hover:border-primary/20 transition-colors">
              <div className="prose text-sm dark:prose-invert max-w-none prose-p:leading-relaxed prose-p:text-muted-foreground/90 prose-pre:bg-muted/50">
                <Streamdown>{markdown}</Streamdown>
              </div>
            </dd>
          </div>
        );
      })}
    </div>
  );
}

// Mobile-only header with video info and collapsible sections navigation
function MobileAnalysisHeader({
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
  onSectionClick?: (sectionId: string) => void;
  videoId?: string;
  title?: string;
  channelName?: string;
  onCopyMarkdown?: () => void;
  copyDisabled?: boolean;
  copied?: boolean;
}) {
  const [sectionsOpen, setSectionsOpen] = useState(false);
  const thumbnailUrl = videoId
    ? `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`
    : undefined;

  return (
    <div className="lg:hidden space-y-4">
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
                  aria-label="Watch on YouTube"
                >
                  <ExternalLink className="h-3 w-3" />
                </a>
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Collapsible sections navigation */}
      {sections.length > 0 && (
        <Collapsible open={sectionsOpen} onOpenChange={setSectionsOpen}>
          <CollapsibleTrigger asChild>
            <Button
              variant="outline"
              className="w-full justify-between h-9 text-sm"
            >
              <span>
                {activeSection
                  ? sections.find((s) => s.id === activeSection)?.title ||
                    "Jump to section"
                  : "Jump to section"}
              </span>
              <ChevronDown
                className={`h-4 w-4 transition-transform ${sectionsOpen ? "rotate-180" : ""}`}
              />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2">
            <div className="rounded-md border bg-card p-2 space-y-1">
              {sections.map((section) => {
                const isActive = section.id === activeSection;
                return (
                  <button
                    key={section.id}
                    type="button"
                    onClick={() => {
                      onSectionClick?.(section.id);
                      setSectionsOpen(false);
                    }}
                    className={`w-full rounded-md px-3 py-2 text-left text-sm transition ${
                      isActive
                        ? "bg-primary/10 text-primary font-medium"
                        : "text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    {section.title}
                  </button>
                );
              })}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}

export function AnalysisSidebar({
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
  onSectionClick?: (sectionId: string) => void;
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

      <div className="flex flex-col flex-1 min-h-0 min-w-0 pr-2">
        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70 px-1 mb-3 shrink-0">
          Sections
        </p>

        <div className="flex-1 min-h-0 relative">
          <ScrollArea type="scroll" className="h-full pr-3">
            <nav className="space-y-1 pb-8">
              {sections.length === 0 ? (
                <div className="space-y-2 px-1">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div
                      key={i}
                      className="h-4 w-[85%] animate-pulse rounded bg-muted/50"
                    />
                  ))}
                </div>
              ) : (
                sections.map((section) => {
                  const isActive = section.id === activeSection;

                  return (
                    <button
                      key={section.id}
                      type="button"
                      onClick={() => onSectionClick?.(section.id)}
                      className={cn(
                        "w-full rounded-md px-2 py-1.5 text-left text-sm transition cursor-pointer hover:bg-muted",
                        isActive
                          ? "bg-muted text-foreground font-medium"
                          : "text-muted-foreground",
                      )}
                    >
                      {section.title}
                    </button>
                  );
                })
              )}
            </nav>
          </ScrollArea>

          {/* Fades for indicating more content */}
          <div className="absolute top-0 left-0 right-0 h-4 bg-gradient-to-b from-background to-transparent pointer-events-none z-10" />
          <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-background to-transparent pointer-events-none z-10" />
        </div>
      </div>
    </aside>
  );
}

export function VideoInfoCard({
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

function toSectionId(title: string) {
  return `analysis-${title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")}`;
}
