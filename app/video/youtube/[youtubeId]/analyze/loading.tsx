import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Copy, FileText, FolderOpen, Grid3x3, Moon } from "lucide-react";

export default function AnalyzeLoading() {
  return (
    <div className="relative flex min-h-screen w-full bg-background">
      {/* 1. Global App Sidebar (Collapsed) */}
      <div className="w-12 border-r flex flex-col items-center py-4 gap-4 bg-[#0a0a0a] text-white">
        <div className="h-8 w-8 rounded-lg bg-white/10 flex items-center justify-center mb-2">
          <span className="font-bold text-sm">N</span>
        </div>
        
        <div className="flex flex-col gap-4 mt-2">
          <div className="p-2 text-white/50">
            <FileText className="h-5 w-5" />
          </div>
          <div className="p-2 text-white/50">
            <FolderOpen className="h-5 w-5" />
          </div>
          <div className="p-2 text-white/50">
            <Grid3x3 className="h-5 w-5" />
          </div>
        </div>

        <div className="mt-auto p-2 text-white/50">
          <Moon className="h-5 w-5" />
        </div>
      </div>

      {/* 2. Main Content Area */}
      <div className="flex-1 flex flex-col">
        <div className="mx-auto w-full max-w-5xl px-6 py-6 grid lg:grid-cols-[240px_1fr] gap-8 h-full">
          
          {/* Left Column: Video Sidebar */}
          <aside className="flex flex-col gap-6 animate-pulse">
            <div className="space-y-4">
              <Skeleton className="aspect-video w-full rounded-xl" />
              
              <div className="space-y-2">
                <Skeleton className="h-5 w-full" />
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-1/3 opacity-50" />
              </div>

              <div className="pt-2">
                <Skeleton className="h-9 w-full rounded-md border border-muted-foreground/20" />
              </div>
            </div>

            <div className="space-y-4 pt-4">
              <div className="px-1">
                <p className="text-[10px] font-black uppercase tracking-[0.15em] text-muted-foreground/50">
                  Sections
                </p>
              </div>
              <div className="space-y-3">
                {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                  <div key={i} className="px-1">
                    <Skeleton className="h-4 w-[70%] rounded opacity-60" />
                  </div>
                ))}
              </div>
            </div>
          </aside>

          {/* Right Column: Main Analysis Content */}
          <div className="space-y-6">
            {[1, 2].map((i) => (
              <Card key={i} className="animate-pulse border-muted/30">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                  <Skeleton className="h-8 w-24 rounded-lg" />
                  <div className="flex items-center gap-2 text-muted-foreground/40">
                    <Copy className="h-4 w-4" />
                    <span className="text-xs font-medium uppercase tracking-wider">Copy</span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-[96%]" />
                    <Skeleton className="h-4 w-[92%]" />
                  </div>
                  
                  {i === 2 && (
                    <div className="pt-6 space-y-4">
                      <p className="text-[10px] font-black uppercase tracking-[0.15em] text-muted-foreground/40">
                        EXPLAIN ONCE RULE
                      </p>
                      <div className="space-y-3 pl-4 border-l-2 border-muted/20">
                        <div className="flex items-start gap-2">
                          <Skeleton className="h-1.5 w-1.5 rounded-full mt-1.5 shrink-0 opacity-40" />
                          <Skeleton className="h-4 w-full" />
                        </div>
                        <div className="flex items-start gap-2">
                          <Skeleton className="h-1.5 w-1.5 rounded-full mt-1.5 shrink-0 opacity-40" />
                          <Skeleton className="h-4 w-[85%]" />
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
