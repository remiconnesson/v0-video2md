"use client";

import {
  ExternalLink,
  FileText,
  FolderOpen,
  Grid3x3,
  Home,
  Moon,
  Sun,
} from "lucide-react";
import Link from "next/link";
import { useTheme } from "next-themes";
import { createParser, useQueryStates } from "nuqs";
import { useEffect, useState } from "react";
import { AnalysisPanel } from "@/components/analyze/analysis-panel";
import { SlidesPanel } from "@/components/analyze/slides-panel";
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

export type AnalyzeTabId = "analyze" | "slides" | "slides-grid";

export const tabs = [
  { id: "analyze" as AnalyzeTabId, label: "Analysis", icon: FileText },
  { id: "slides" as AnalyzeTabId, label: "Slide Curation", icon: FolderOpen },
  { id: "slides-grid" as AnalyzeTabId, label: "Slides Grid", icon: Grid3x3 },
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
};

type AnalyzeShellProps = {
  videoId: string;
  title: string;
  channelName: string;
};

export function AnalyzeShell({
  videoId,
  title,
  channelName,
}: AnalyzeShellProps) {
  const [queryState, setQueryState] = useQueryStates(tabQueryConfig);
  const activeTab: AnalyzeTabId = queryState.slidesGrid
    ? "slides-grid"
    : queryState.slides
      ? "slides"
      : "analyze";
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const isDark = resolvedTheme === "dark";

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleTabChange = (tab: AnalyzeTabId) => {
    if (tab === "slides-grid") {
      void setQueryState({ slidesGrid: true, slides: null, analyze: null });
      return;
    }

    if (tab === "slides") {
      void setQueryState({ slides: true, slidesGrid: null, analyze: null });
      return;
    }

    void setQueryState({ analyze: true, slides: null, slidesGrid: null });
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
        />
        <SidebarInset className="flex flex-col">
          <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 py-6">
            {activeTab !== "analyze" && (
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
}: {
  activeTab: AnalyzeTabId;
  onTabChange?: (tab: AnalyzeTabId) => void;
  mounted?: boolean;
  isDark?: boolean;
  onToggleTheme?: () => void;
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
          {tabs.map((tab) => {
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
