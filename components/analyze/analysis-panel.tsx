"use client";

import { FileText } from "lucide-react";
import { Streamdown } from "streamdown";
import type {
  AnalysisValue,
  GeneratedSchema,
  GodPromptAnalysis,
} from "@/ai/dynamic-analysis-prompt";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SectionFeedback } from "./section-feedback";

interface AnalysisPanelProps {
  analysis: GodPromptAnalysis;
  schema: GeneratedSchema;
  runId: number | null;
  videoId: string;
}

export function AnalysisPanel({
  analysis,
  schema,
  runId,
  videoId,
}: AnalysisPanelProps) {
  const { required_sections, additional_sections } = analysis;

  // Helper to render different value types
  const renderValue = (value: unknown, sectionKey: string): React.ReactNode => {
    if (value === null || value === undefined || value === "") {
      return <p className="text-muted-foreground italic">No content</p>;
    }

    if (typeof value === "string") {
      return (
        <div className="prose prose-sm dark:prose-invert max-w-none">
          <Streamdown>{value}</Streamdown>
        </div>
      );
    }

    if (Array.isArray(value)) {
      if (value.length === 0) {
        return <p className="text-muted-foreground italic">No items</p>;
      }
      return (
        <ul className="space-y-2">
          {value.map((item, idx) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: using index is intentional here
            <li key={`${sectionKey}-${idx}`} className="flex gap-2">
              <span className="text-muted-foreground">•</span>
              <span>
                {typeof item === "string" ? item : JSON.stringify(item)}
              </span>
            </li>
          ))}
        </ul>
      );
    }

    if (typeof value === "object") {
      return (
        <pre className="text-xs bg-muted p-3 rounded-lg overflow-auto">
          {JSON.stringify(value, null, 2)}
        </pre>
      );
    }

    return <p>{String(value)}</p>;
  };

  // Render analysis value based on kind
  const renderAnalysisValue = (section: AnalysisValue): React.ReactNode => {
    switch (section.kind) {
      case "string":
        return renderValue(section.value, section.key);
      case "array":
        return renderValue(section.value, section.key);
      case "object":
        // Object values are array of {key, value} pairs
        if (section.value.length === 0) {
          return <p className="text-muted-foreground italic">No entries</p>;
        }
        return (
          <dl className="space-y-2">
            {section.value.map((entry) => (
              <div key={entry.key} className="grid grid-cols-[auto,1fr] gap-2">
                <dt className="font-medium text-muted-foreground">
                  {entry.key}:
                </dt>
                <dd>{entry.value}</dd>
              </div>
            ))}
          </dl>
        );
    }
  };

  const renderSection = (
    key: string,
    content: React.ReactNode,
    description?: string,
  ) => (
    <div key={key} className="pb-6 border-b last:border-0 last:pb-0">
      <div className="flex items-start justify-between gap-4 mb-3">
        <div>
          <h3 className="font-semibold text-base">{formatSectionTitle(key)}</h3>
          {description && (
            <p className="text-xs text-muted-foreground mt-0.5">
              {description}
            </p>
          )}
        </div>

        {runId && (
          <SectionFeedback
            videoId={videoId}
            runId={runId}
            sectionKey={key}
          />
        )}
      </div>

      <div className="mt-2">{content}</div>
    </div>
  );

  const hasRequiredContent =
    required_sections.tldr ||
    required_sections.transcript_corrections ||
    required_sections.detailed_summary;
  const hasAdditionalContent = additional_sections.length > 0;

  if (!hasRequiredContent && !hasAdditionalContent) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <FileText className="h-5 w-5" />
            Extracted Analysis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            No analysis content yet.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <FileText className="h-5 w-5" />
          Extracted Analysis
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Required sections */}
        {required_sections.tldr &&
          renderSection(
            "tldr",
            renderValue(required_sections.tldr, "tldr"),
            "A short summary of the transcript",
          )}

        {required_sections.detailed_summary &&
          renderSection(
            "detailed_summary",
            renderValue(
              required_sections.detailed_summary,
              "detailed_summary",
            ),
            "A detailed summary of the transcript",
          )}

        {required_sections.transcript_corrections &&
          renderSection(
            "transcript_corrections",
            renderValue(
              required_sections.transcript_corrections,
              "transcript_corrections",
            ),
            "Corrections to the transcript",
          )}

        {/* Additional sections */}
        {additional_sections.map((section) => {
          const sectionDef = schema.sections?.[section.key];
          return renderSection(
            section.key,
            renderAnalysisValue(section),
            sectionDef?.description,
          );
        })}
      </CardContent>
    </Card>
  );
}

// Convert snake_case to Title Case
function formatSectionTitle(key: string): string {
  return key
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
