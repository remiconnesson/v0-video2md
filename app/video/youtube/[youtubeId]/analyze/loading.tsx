"use client";

import { AnalyzeSidebar } from "@/components/analyze/analyze-shell";
import { AnalysisSidebar } from "@/components/analyze/analysis-panel";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Copy } from "lucide-react";

export default function AnalyzeLoading() {
  return (
    <SidebarProvider defaultOpen={false}>
      <div className="relative flex min-h-screen w-full">
        <AnalyzeSidebar activeTab="analyze" />
        <SidebarInset className="flex flex-col">
          <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 py-6">
            <div className="space-y-4">
              {/* This matches the min-h-5 container in AnalysisPanel to prevent layout shift */}
              <div className="min-h-5 flex items-center">
                <p className="text-sm text-muted-foreground animate-pulse">
                  Preparing video analysis...
                </p>
              </div>

              <div className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
                <AnalysisSidebar sections={[]} />

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
          </div>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
