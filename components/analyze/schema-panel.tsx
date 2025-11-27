"use client";

import { Code2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { GeneratedSchema } from "@/db/schema";

interface SchemaPanelProps {
  schema: GeneratedSchema;
}

export function SchemaPanel({ schema }: SchemaPanelProps) {
  const sections = schema.sections ?? [];

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
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {sections.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No schema sections generated yet.
          </p>
        ) : (
          <div className="space-y-3">
            {sections.map((section) => (
              <div
                key={section.key}
                className="p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <code className="text-sm font-semibold">
                        {section.key}
                      </code>
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
      </CardContent>
    </Card>
  );
}
