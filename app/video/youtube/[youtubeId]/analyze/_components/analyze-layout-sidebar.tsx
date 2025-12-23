"use client";

import { Moon, Sun } from "lucide-react";
import Link from "next/link";
import { useSelectedLayoutSegment } from "next/navigation";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { VideoInfoCard } from "@/components/analyze/video-info-card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { ANALYZE_ROUTES, isRouteAvailable } from "./analyze-route-map";

interface AnalyzeLayoutSidebarProps {
  videoId: string;
  title: string;
  channelName: string;
  hasTranscriptAnalysis: boolean;
  hasSlideAnalysis: boolean;
}

export function AnalyzeLayoutSidebar({
  videoId,
  title,
  channelName,
  hasTranscriptAnalysis,
  hasSlideAnalysis,
}: AnalyzeLayoutSidebarProps) {
  const segment = useSelectedLayoutSegment();
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const isDark = resolvedTheme === "dark";

  useEffect(() => {
    setMounted(true);
  }, []);

  const availableRoutes = ANALYZE_ROUTES.filter((route) =>
    isRouteAvailable(route, hasTranscriptAnalysis, hasSlideAnalysis),
  );

  return (
    <aside className="hidden lg:flex flex-col w-[280px] shrink-0 sticky top-0 self-start h-screen border-r bg-background/50 backdrop-blur-sm">
      <div className="flex flex-col h-full p-4">
        {/* Video Info Card */}
        <div className="shrink-0 mb-6">
          <VideoInfoCard
            videoId={videoId}
            title={title}
            channelName={channelName}
          />
        </div>

        {/* Route Navigation */}
        <div className="flex-1 min-h-0">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70 px-1 mb-3">
            Navigation
          </p>
          <ScrollArea className="h-full">
            <nav className="space-y-1 pr-2">
              {availableRoutes.map((route) => {
                const Icon = route.icon;
                const isActive = segment === route.id;

                return (
                  <Link
                    key={route.id}
                    href={`/video/youtube/${videoId}/analyze/${route.id}`}
                    className={cn(
                      "flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors",
                      isActive
                        ? "bg-primary text-primary-foreground font-medium"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted",
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="truncate">{route.label}</span>
                  </Link>
                );
              })}
            </nav>
          </ScrollArea>
        </div>

        {/* Dark Mode Toggle */}
        <div className="shrink-0 pt-4 border-t">
          {mounted ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setTheme(isDark ? "light" : "dark")}
              className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground"
            >
              {isDark ? (
                <>
                  <Sun className="h-4 w-4" />
                  Light mode
                </>
              ) : (
                <>
                  <Moon className="h-4 w-4" />
                  Dark mode
                </>
              )}
            </Button>
          ) : (
            <div className="h-9 w-full animate-pulse rounded bg-muted/50" />
          )}
        </div>
      </div>
    </aside>
  );
}
