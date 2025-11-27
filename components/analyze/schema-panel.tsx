"use client";

import { Code2, Loader2, Play } from "lucide-react";
import { useState } from "react";
import type { GeneratedSchema } from "@/ai/dynamic-analysis-schema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface SchemaPanelProps {
  schema: GeneratedSchema;
  runId: number | null;
  videoId: string;
}

export function SchemaPanel({ schema, runId, videoId }: SchemaPanelProps) {
  const [isRunningDerived, setIsRunningDerived] = useState(false);
  const [derivedResult, setDerivedResult] = useState<Record<
    string,
    unknown
  > | null>(null);

  const sections = Object.entries(schema.sections ?? {});

  const handleRunSchema = async () => {
    if (!runId) return;

    setIsRunningDerived(true);
    setDerivedResult(null);

    try {
      const res = await fetch(`/api/video/${videoId}/analyze/${runId}/derive`, {
        method: "POST",
      });

      if (!res.ok) {
        throw new Error("Failed to run derived analysis");
      }

      const data = await res.json();
      setDerivedResult(data.analysis);
    } catch (err) {
      console.error("Derived analysis failed:", err);
    } finally {
      setIsRunningDerived(false);
    }
  };

  const typeColors: Record<string, string> = {
    string: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    "string[]":
      "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    object:
      "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Code2 className="h-5 w-5" />
              Generated Schema
            </CardTitle>
            <CardDescription>
              {sections.length} section{sections.length !== 1 ? "s" : ""}{" "}
              designed for this content
            </CardDescription>
          </div>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRunSchema}
                  disabled={!runId || isRunningDerived}
                  className="gap-2"
                >
                  {isRunningDerived ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Play className="h-4 w-4" />
                  )}
                  Run Schema
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Run this schema as a separate extraction prompt</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {sections.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No schema sections generated yet.
          </p>
        ) : (
          <div className="space-y-3">
            {sections.map(([key, section]) => (
              <div
                key={key}
                className="p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <code className="text-sm font-semibold">{key}</code>
                      <Badge
                        variant="secondary"
                        className={typeColors[section.type] ?? ""}
                      >
                        {section.type}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {section.description}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Derived result preview */}
        {derivedResult && (
          <div className="mt-6 pt-6 border-t">
            <h4 className="font-medium mb-3">Derived Analysis Result</h4>
            <pre className="text-xs bg-muted p-4 rounded-lg overflow-auto max-h-96">
              {JSON.stringify(derivedResult, null, 2)}
            </pre>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
