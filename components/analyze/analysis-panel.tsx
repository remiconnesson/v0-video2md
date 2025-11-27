"use client";

import { FileText } from "lucide-react";
import { Streamdown } from "streamdown";
import type { GeneratedSchema } from "@/ai/dynamic-analysis-schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SectionFeedback } from "./section-feedback";

interface AnalysisPanelProps {
  analysis: Record<string, unknown>;
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
  const sections = Object.entries(analysis ?? {});

  // Helper to render different value types
  const renderValue = (value: unknown, sectionKey: string): React.ReactNode => {
    if (value === null || value === undefined) {
      return <p className="text-muted-foreground italic">No content</p>;
    }

    if (typeof value === "string") {
      // Check if it's a mermaid diagram
      if (value.includes("```mermaid")) {
        return (
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <Streamdown>{value}</Streamdown>
          </div>
        );
      }
      return (
        <div className="prose prose-sm dark:prose-invert max-w-none">
          <Streamdown>{value}</Streamdown>
        </div>
      );
    }

    if (Array.isArray(value)) {
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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <FileText className="h-5 w-5" />
          Extracted Analysis
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-6">
        {sections.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No analysis content yet.
          </p>
        ) : (
          sections.map(([key, value]) => {
            const sectionDef = schema.sections?.[key];

            return (
              <div key={key} className="pb-6 border-b last:border-0 last:pb-0">
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div>
                    <h3 className="font-semibold text-base">
                      {formatSectionTitle(key)}
                    </h3>
                    {sectionDef && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {sectionDef.description}
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

                <div className="mt-2">{renderValue(value, key)}</div>
              </div>
            );
          })
        )}
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
