"use client";

import { Brain } from "lucide-react";
import { Streamdown } from "streamdown";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface ReasoningPanelProps {
  reasoning: string;
  isStreaming?: boolean;
}

export function ReasoningPanel({
  reasoning,
  isStreaming,
}: ReasoningPanelProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Brain className="h-5 w-5" />
          AI Reasoning
          {isStreaming && (
            <span className="text-xs font-normal text-muted-foreground animate-pulse">
              thinking...
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="prose prose-sm dark:prose-invert max-w-none">
          <Streamdown>{reasoning || "_Waiting for reasoning..._"}</Streamdown>
        </div>
      </CardContent>
    </Card>
  );
}
