"use client";

import Link from "next/link";
import { useSelectedLayoutSegment } from "next/navigation";
import { cn } from "@/lib/utils";
import { ANALYZE_ROUTES, isRouteAvailable } from "./analyze-route-map";

interface AnalyzeNavProps {
  videoId: string;
  hasTranscriptAnalysis: boolean;
  hasSlideAnalysis: boolean;
}

export function AnalyzeNav({
  videoId,
  hasTranscriptAnalysis,
  hasSlideAnalysis,
}: AnalyzeNavProps) {
  const segment = useSelectedLayoutSegment();

  const availableRoutes = ANALYZE_ROUTES.filter((route) =>
    isRouteAvailable(route, hasTranscriptAnalysis, hasSlideAnalysis),
  );

  return (
    <nav className="flex gap-1">
      {availableRoutes.map((route) => {
        const Icon = route.icon;
        const isActive = segment === route.id;

        return (
          <Link
            key={route.id}
            href={`/video/youtube/${videoId}/analyze/${route.id}`}
            className={cn(
              "flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors",
              isActive
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-muted",
            )}
          >
            <Icon className="h-4 w-4" />
            {route.label}
          </Link>
        );
      })}
    </nav>
  );
}
