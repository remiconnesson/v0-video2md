"use client";

import { Menu } from "lucide-react";
import Link from "next/link";
import { useSelectedLayoutSegment } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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

  const currentRoute = availableRoutes.find((route) => route.id === segment);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          {currentRoute && (
            <>
              <currentRoute.icon className="h-4 w-4" />
              <span className="hidden sm:inline">{currentRoute.label}</span>
            </>
          )}
          <Menu className="h-4 w-4" />
          <span className="sr-only">Open menu</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-56 p-2">
        <div className="flex flex-col gap-1">
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
                    ? "bg-muted font-medium text-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
                )}
              >
                <Icon className="h-4 w-4" />
                {route.label}
              </Link>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
