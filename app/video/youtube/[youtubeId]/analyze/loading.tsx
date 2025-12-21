import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2, FileText, Video } from "lucide-react";

export default function AnalyzeLoading() {
  return (
    <div className="relative flex min-h-screen w-full">
      {/* Sidebar skeleton */}
      <div className="w-14 border-r bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex h-full flex-col items-center justify-between py-4">
          {/* Home icon placeholder */}
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-muted/50">
            <div className="h-4 w-4 bg-muted-foreground/30 rounded-sm" />
          </div>

          {/* Tab icons */}
          <div className="flex flex-col gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
              <FileText className="h-4 w-4" />
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-muted/50">
              <div className="h-4 w-4 bg-muted-foreground/30 rounded-sm" />
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-muted/50">
              <div className="h-4 w-4 bg-muted-foreground/30 rounded-sm" />
            </div>
          </div>

          {/* Theme toggle placeholder */}
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-muted/50">
            <div className="h-4 w-4 bg-muted-foreground/30 rounded-sm" />
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 py-6">
          {/* Loading header with spinner */}
          <div className="flex flex-col items-center justify-center gap-4 py-12">
            <div className="relative">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
              <div className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full bg-background border shadow-sm">
                <Video className="h-4 w-4 text-muted-foreground" />
              </div>
            </div>

            <div className="text-center space-y-2">
              <h2 className="text-xl font-semibold tracking-tight">
                Preparing Video Analysis
              </h2>
              <p className="text-sm text-muted-foreground max-w-sm">
                Fetching transcript data and setting up your personalized analysis experience
              </p>
            </div>

            {/* Progress dots */}
            <div className="flex gap-1">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="h-2 w-2 rounded-full bg-primary/60 animate-pulse"
                  style={{ animationDelay: `${i * 0.2}s` }}
                />
              ))}
            </div>
          </div>

          {/* Video info skeleton */}
          <Card className="animate-pulse">
            <CardHeader>
              <div className="flex gap-4">
                <Skeleton className="h-20 w-32 rounded-md" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-6 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                  <div className="flex gap-2">
                    <Skeleton className="h-8 w-20" />
                    <Skeleton className="h-8 w-24" />
                  </div>
                </div>
              </div>
            </CardHeader>
          </Card>

          {/* Analysis sections skeleton */}
          <div className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
            {/* Sidebar skeleton */}
            <div className="hidden lg:flex flex-col">
              <Card className="animate-pulse">
                <CardHeader>
                  <Skeleton className="h-5 w-16" />
                </CardHeader>
                <CardContent className="space-y-2">
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-3/4" />
                  <Skeleton className="h-8 w-2/3" />
                </CardContent>
              </Card>
            </div>

            {/* Content skeleton */}
            <div className="space-y-6">
              {[1, 2, 3].map((i) => (
                <Card key={i} className="animate-pulse">
                  <CardHeader>
                    <Skeleton className="h-7 w-48" />
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-5/6" />
                    <Skeleton className="h-4 w-4/5" />
                    {i === 1 && (
                      <>
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-3/4" />
                      </>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
