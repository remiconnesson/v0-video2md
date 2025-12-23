"use client";

import { Copy } from "lucide-react";
import { AnalysisSidebar } from "@/components/analyze/analysis-panel";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function AnalyzeLoading() {
  return (
    <div className="container mx-auto px-4 py-6">
      <div className="flex flex-col gap-4">
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
      </div>
    </div>
  );
}
