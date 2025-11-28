"use client";

import { FileText } from "lucide-react";
import { Streamdown } from "streamdown";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { isRecord } from "@/lib/type-utils";
import { SectionFeedback } from "./section-feedback";

interface AnalysisPanelProps {
  analysis: Record<string, unknown>;
  runId: number | null;
  videoId: string;
}

export function AnalysisPanel({
  analysis,
  runId,
  videoId,
}: AnalysisPanelProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <FileText className="h-5 w-5" />
          Extracted Analysis
        </CardTitle>
      </CardHeader>

      <CardContent>
        {Object.entries(analysis).map(([key, value]) => (
          <Section
            key={key}
            title={key}
            content={value}
            runId={runId}
            videoId={videoId}
          />
        ))}
      </CardContent>
    </Card>
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
      <ul className="space-y-2">
        {content.map((item, idx) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: using index is intentional here
          <li key={idx} className="flex gap-2">
            <span className="text-muted-foreground">•</span>
            <span>
              {typeof item === "string" ? item : JSON.stringify(item)}
            </span>
          </li>
        ))}
      </ul>
    );
  }

  if (isRecord(content)) {
    return <ObjectSection data={content} />;
  }

  return <p>{String(content)}</p>;
}

function Section({
  title,
  content,
  runId,
  videoId,
  description,
}: {
  key: string;
  content: unknown;
  runId: number | null;
  videoId: string;
  description?: string;
}) {
  const key = title;
  return (
    <div key={key} className="pb-6 border-b last:border-0 last:pb-0 pt-4">
      <div className="flex items-start justify-between gap-4 mb-3">
        <div>
          <h3 className="font-semibold text-base">
            {formatSectionTitle(title) || title}
          </h3>
          {description && (
            <p className="text-xs text-muted-foreground mt-0.5">
              {description}
            </p>
          )}
        </div>

        {runId && (
          <SectionFeedback videoId={videoId} runId={runId} sectionKey={key} />
        )}
      </div>

      <div className="mt-2">
        <SectionContent content={content} />
      </div>
    </div>
  );
}

// Convert snake_case to Title Case
function formatSectionTitle(key: string): string {
  if (!key || typeof key !== "string") {
    return "";
  }
  return key
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
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
