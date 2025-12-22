"use client";

import {
  ExternalLink,
  FileText,
  FolderOpen,
  Grid3x3,
  Home,
  Moon,
  Sparkles,
  Stars,
  Sun,
} from "lucide-react";
import Link from "next/link";
import { useTheme } from "next-themes";
import { createParser, useQueryStates } from "nuqs";
import { useEffect, useState } from "react";
import { AnalysisPanel } from "@/components/analyze/analysis-panel";
import { SlideAnalysisPanel } from "@/components/analyze/slide-analysis-panel";
import { SlidesPanel } from "@/components/analyze/slides-panel";
import { SuperAnalysisPanel } from "@/components/analyze/super-analysis-panel";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

export type AnalyzeTabId =
  | "analyze"
  | "slides"
  | "slides-grid"
  | "slide-analysis"
  | "super-analysis";

export const tabs = [
  { id: "analyze" as AnalyzeTabId, label: "Analysis", icon: FileText },
  {
    id: "super-analysis" as AnalyzeTabId,
    label: "Super Analysis",
    icon: Stars,
  },
  { id: "slides" as AnalyzeTabId, label: "Slide Curation", icon: FolderOpen },
  { id: "slides-grid" as AnalyzeTabId, label: "Slides Grid", icon: Grid3x3 },
  {
    id: "slide-analysis" as AnalyzeTabId,
    label: "Slide Analysis",
    icon: Sparkles,
  },
];

const parseAsPresence = createParser<boolean>({
  parse: (value) =>
    value === "" || value.toLowerCase() === "true" ? true : null,
  serialize: () => "",
});

const tabQueryConfig = {
  analyze: parseAsPresence,
  slides: parseAsPresence,
  slidesGrid: parseAsPresence,
  slideAnalysis: parseAsPresence,
  superAnalysis: parseAsPresence,
};

type AnalyzeShellProps = {
  videoId: string;
  title: string;
  channelName: string;
  hasTranscriptAnalysis: boolean;
  hasSlideAnalysis: boolean;
};

export function AnalyzeShell({
  videoId,
  title,
  channelName,
  hasTranscriptAnalysis,
  hasSlideAnalysis,
}: AnalyzeShellProps) {
  const [queryState, setQueryState] = useQueryStates(tabQueryConfig);
  const hasSuperAnalysis = hasTranscriptAnalysis && hasSlideAnalysis;
  const activeTab: AnalyzeTabId =
    queryState.superAnalysis && hasSuperAnalysis
      ? "super-analysis"
      : queryState.slideAnalysis
        ? "slide-analysis"
        : queryState.slidesGrid
          ? "slides-grid"
          : queryState.slides
            ? "slides"
            : "analyze";
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const isDark = resolvedTheme === "dark";
  const visibleTabs = hasSuperAnalysis
    ? tabs
    : tabs.filter((tab) => tab.id !== "super-analysis");

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!queryState.superAnalysis || hasSuperAnalysis) return;

    void setQueryState({
      superAnalysis: null,
      analyze: true,
      slides: null,
      slidesGrid: null,
      slideAnalysis: null,
    });
  }, [hasSuperAnalysis, queryState.superAnalysis, setQueryState]);

  const handleTabChange = (tab: AnalyzeTabId) => {
    if (tab === "super-analysis") {
      if (!hasSuperAnalysis) return;

      void setQueryState({
        superAnalysis: true,
        slideAnalysis: null,
        slidesGrid: null,
        slides: null,
        analyze: null,
      });
      return;
    }

    if (tab === "slide-analysis") {
      void setQueryState({
        slideAnalysis: true,
        superAnalysis: null,
        slidesGrid: null,
        slides: null,
        analyze: null,
      });
      return;
    }

    if (tab === "slides-grid") {
      void setQueryState({
        slidesGrid: true,
        slideAnalysis: null,
        superAnalysis: null,
        slides: null,
        analyze: null,
      });
      return;
    }

    if (tab === "slides") {
      void setQueryState({
        slides: true,
        slideAnalysis: null,
        superAnalysis: null,
        slidesGrid: null,
        analyze: null,
      });
      return;
    }

    void setQueryState({
      analyze: true,
      superAnalysis: null,
      slideAnalysis: null,
      slides: null,
      slidesGrid: null,
    });
  };

  return (
    <SidebarProvider defaultOpen={false}>
      <div className="relative flex min-h-screen w-full">
        <AnalyzeSidebar
          activeTab={activeTab}
          onTabChange={handleTabChange}
          mounted={mounted}
          isDark={isDark}
          onToggleTheme={() => setTheme(isDark ? "light" : "dark")}
          tabs={visibleTabs}
        />
        <SidebarInset className="flex flex-col">
          <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 py-6">
            {activeTab !== "analyze" &&
              activeTab !== "slide-analysis" &&
              activeTab !== "super-analysis" && (
                <VideoInfoDisplay
                  title={title}
                  channelName={channelName}
                  youtubeId={videoId}
                />
              )}
            <AnalyzeTabContent
              activeTab={activeTab}
              videoId={videoId}
              title={title}
              channelName={channelName}
            />
          </div>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}

export function AnalyzeSidebar({
  activeTab,
  onTabChange,
  mounted,
  isDark,
  onToggleTheme,
  tabs: visibleTabs,
}: {
  activeTab: AnalyzeTabId;
  onTabChange?: (tab: AnalyzeTabId) => void;
  mounted?: boolean;
  isDark?: boolean;
  onToggleTheme?: () => void;
  tabs: typeof tabs;
}) {
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
          {visibleTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <SidebarMenuItem key={tab.id}>
                <SidebarMenuButton
                  tooltip={tab.label}
                  isActive={isActive}
                  onClick={() => onTabChange?.(tab.id)}
                  className={cn(
                    "relative flex items-center justify-center",
                    isActive && "bg-sidebar-accent",
                  )}
                >
                  <Icon className="size-5" />
                  {isActive ? (
                    <div className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r bg-primary" />
                  ) : null}
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
                onClick={onToggleTheme}
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

function AnalyzeTabContent({
  activeTab,
  videoId,
  title,
  channelName,
}: {
  activeTab: AnalyzeTabId;
  videoId: string;
  title: string;
  channelName: string;
}) {
  if (activeTab === "slides") {
    return <SlidesPanel videoId={videoId} view="curation" />;
  }

  if (activeTab === "slides-grid") {
    return <SlidesPanel videoId={videoId} view="grid" />;
  }

  if (activeTab === "slide-analysis") {
    return <SlideAnalysisPanel videoId={videoId} />;
  }

  if (activeTab === "super-analysis") {
    return (
      <SuperAnalysisPanel
        videoId={videoId}
        title={title}
        channelName={channelName}
      />
    );
  }

  return (
    <AnalysisPanel videoId={videoId} title={title} channelName={channelName} />
  );
}

function VideoInfoDisplay({
  title,
  channelName,
  youtubeId,
}: {
  title: string;
  channelName: string;
  youtubeId: string;
}) {
  return (
    <div className="min-w-0">
      <h1 className="truncate text-2xl font-bold">{title}</h1>

      <div className="mt-1 flex items-center gap-3">
        <span className="text-sm text-muted-foreground">{channelName}</span>

        <a
          href={`https://www.youtube.com/watch?v=${youtubeId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ExternalLink className="h-3 w-3" />
          Watch
        </a>
      </div>
    </div>
  );
}
