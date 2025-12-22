"use client";

import { createParser, useQueryStates } from "nuqs";
import { AnalysisPanel } from "@/components/analyze/analysis-panel";
import { SlidesPanel } from "@/components/analyze/slides-panel";
import { SuperAnalysisPanel } from "@/components/analyze/super-analysis-panel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const parseAsPresence = createParser<boolean>({
  parse: (value) =>
    value === "" || value.toLowerCase() === "true" ? true : null,
  serialize: () => "",
});

const tabQueryConfig = {
  analyze: parseAsPresence,
  slides: parseAsPresence,
  slidesGrid: parseAsPresence,
  superAnalysis: parseAsPresence,
};

type AnalyzeTabsProps = {
  videoId: string;
  title: string;
  channelName: string;
  hasTranscriptAnalysis: boolean;
  hasSlideAnalysis: boolean;
};

export function AnalyzeTabs({
  videoId,
  title,
  channelName,
  hasTranscriptAnalysis,
  hasSlideAnalysis,
}: AnalyzeTabsProps) {
  const [queryState, setQueryState] = useQueryStates(tabQueryConfig);
  const hasSuperAnalysis = hasTranscriptAnalysis && hasSlideAnalysis;
  const activeTab =
    queryState.superAnalysis && hasSuperAnalysis
      ? "super-analysis"
      : queryState.slidesGrid
        ? "slides-grid"
        : queryState.slides
          ? "slides"
          : "analyze";

  const handleTabChange = (value: string) => {
    if (value === "slides-grid") {
      void setQueryState({
        slidesGrid: true,
        slides: null,
        analyze: null,
        superAnalysis: null,
      });
      return;
    }

    if (value === "slides") {
      void setQueryState({
        slides: true,
        slidesGrid: null,
        analyze: null,
        superAnalysis: null,
      });
      return;
    }

    if (value === "super-analysis") {
      if (!hasSuperAnalysis) return;
      void setQueryState({
        superAnalysis: true,
        slidesGrid: null,
        slides: null,
        analyze: null,
      });
      return;
    }

    void setQueryState({
      analyze: true,
      slides: null,
      slidesGrid: null,
      superAnalysis: null,
    });
  };

  return (
    <Tabs
      value={activeTab}
      onValueChange={handleTabChange}
      className="space-y-4"
    >
      <TabsList>
        <TabsTrigger value="analyze">Analysis</TabsTrigger>
        {hasSuperAnalysis ? (
          <TabsTrigger value="super-analysis">Super Analysis</TabsTrigger>
        ) : null}
        <TabsTrigger value="slides">Slide Curation</TabsTrigger>
        <TabsTrigger value="slides-grid">Slides Grid</TabsTrigger>
      </TabsList>

      <TabsContent value="analyze">
        <AnalysisPanel
          videoId={videoId}
          title={title}
          channelName={channelName}
        />
      </TabsContent>

      <TabsContent value="slides">
        <SlidesPanel videoId={videoId} view="curation" />
      </TabsContent>

      <TabsContent value="slides-grid">
        <SlidesPanel videoId={videoId} view="grid" />
      </TabsContent>

      <TabsContent value="super-analysis">
        <SuperAnalysisPanel
          videoId={videoId}
          title={title}
          channelName={channelName}
        />
      </TabsContent>
    </Tabs>
  );
}
