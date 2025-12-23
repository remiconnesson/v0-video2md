"use client";

import { Home, Moon, Sun } from "lucide-react";
import Link from "next/link";
import { useSelectedLayoutSegment } from "next/navigation";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { ANALYZE_ROUTES, isRouteAvailable } from "./analyze-route-map";

interface AnalyzeLayoutSidebarProps {
  videoId: string;
  hasTranscriptAnalysis: boolean;
  hasSlideAnalysis: boolean;
}

export function AnalyzeLayoutSidebar({
  videoId,
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
    <Sidebar variant="floating" collapsible="icon">
      <SidebarHeader className="flex items-center justify-center py-4">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              tooltip="Home"
              className="flex items-center justify-center"
            >
              <Link href="/">
                <Home className="size-5" />
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarSeparator />

      <SidebarContent className="px-2 py-2">
        <SidebarMenu>
          {availableRoutes.map((route) => {
            const Icon = route.icon;
            const isActive = segment === route.id;
            return (
              <SidebarMenuItem key={route.id}>
                <SidebarMenuButton
                  asChild
                  tooltip={route.label}
                  isActive={isActive}
                  className={cn(
                    "relative flex items-center justify-center",
                    isActive && "bg-sidebar-accent",
                  )}
                >
                  <Link href={`/video/youtube/${videoId}/analyze/${route.id}`}>
                    <Icon className="size-5" />
                    {isActive && (
                      <div className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r bg-primary" />
                    )}
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarContent>

      <SidebarFooter className="flex items-center justify-center py-4">
        <SidebarMenu>
          <SidebarMenuItem>
            {mounted ? (
              <SidebarMenuButton
                tooltip={
                  isDark ? "Switch to light mode" : "Switch to dark mode"
                }
                onClick={() => setTheme(isDark ? "light" : "dark")}
                className="flex items-center justify-center"
              >
                {isDark ? (
                  <Sun className="size-5" />
                ) : (
                  <Moon className="size-5" />
                )}
              </SidebarMenuButton>
            ) : (
              <div className="flex items-center justify-center size-9 animate-pulse rounded bg-muted/50">
                <div className="size-5 bg-muted-foreground/30 rounded-full" />
              </div>
            )}
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
