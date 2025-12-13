"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { Streamdown } from "streamdown";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { analysisToMarkdown, formatSectionTitle } from "@/lib/analysis-format";
import { isRecord } from "@/lib/type-utils";

// ============================================================================
// Analysis Panel - Main Component
// ============================================================================

interface AnalysisPanelProps {
  analysis: Record<string, unknown>;
  runId: number | null;
  videoId: string;
}

// ============================================================================
// Content Conversion Utilities
// ============================================================================

// ============================================================================
// Main Panel Component
// ============================================================================

export function AnalysisPanel({
  analysis,
  runId,
  videoId,
}: AnalysisPanelProps) {
  const [copied, setCopied] = useState(false);

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

  console.log(analysis);
  return (
    <div className="space-y-4">
      <CopyButton copied={copied} onCopy={handleCopyMarkdown} />

      {Object.entries(analysis).map(([key, value]) => (
        <Section
          key={key}
          title={key}
          content={value}
          runId={runId}
          videoId={videoId}
        />
      ))}
    </div>
  );
}

// ============================================================================
// Sub-components
// ============================================================================

function CopyButton({
  copied,
  onCopy,
}: {
  copied: boolean;
  onCopy: () => void;
}) {
  return (
    <div className="flex justify-end">
      <Button variant="outline" size="sm" onClick={onCopy} className="gap-2">
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

function Section({
  title,
  content,
  runId,
  videoId,
  description,
}: {
  title: string;
  key: string;
  content: unknown;
  runId: number | null;
  videoId: string;
  description?: string;
}) {
  const key = title;
  const formattedTitle = formatSectionTitle(title) || title;
  const hasFeedback = runId !== null;

  return (
    <Card key={key}>
      <CardHeader>
        <SectionHeader
          title={formattedTitle}
          description={description}
          videoId={videoId}
          runId={runId}
          sectionKey={key}
          hasFeedback={hasFeedback}
        />
      </CardHeader>

      <CardContent>
        <SectionContent content={content} />
      </CardContent>
    </Card>
  );
}

function SectionHeader({
  title,
  description,
}: {
  title: string;
  description?: string;
  videoId: string;
  runId: number | null;
  sectionKey: string;
  hasFeedback: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <CardTitle className="text-base">{title}</CardTitle>
        {description && (
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        )}
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
