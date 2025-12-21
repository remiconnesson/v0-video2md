"use client";

import { createParser, useQueryStates } from "nuqs";
import { AnalysisPanel } from "@/components/analyze/analysis-panel";
import { SlidesPanel } from "@/components/analyze/slides-panel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const parseAsPresence = createParser<boolean>({
  parse: (value) =>
    value === "" || value.toLowerCase() === "true" ? true : null,
  serialize: () => "",
});

const tabQueryConfig = {
  analyze: parseAsPresence,
  slides: parseAsPresence,
};

type AnalyzeTabsProps = {
  videoId: string;
};

export function AnalyzeTabs({ videoId }: AnalyzeTabsProps) {
  const [queryState, setQueryState] = useQueryStates(tabQueryConfig);
  const activeTab = queryState.slides ? "slides" : "analyze";

  const handleTabChange = (value: string) => {
    if (value === "slides") {
      void setQueryState({ slides: true, analyze: null });
      return;
    }

    void setQueryState({ analyze: true, slides: null });
  };

  return (
    <Tabs
      value={activeTab}
      onValueChange={handleTabChange}
      className="space-y-4"
    >
      <TabsList>
        <TabsTrigger value="analyze">Analysis</TabsTrigger>
        <TabsTrigger value="slides">Slides</TabsTrigger>
      </TabsList>

      <TabsContent value="analyze">
        <AnalysisPanel videoId={videoId} />
      </TabsContent>

      <TabsContent value="slides">
        <SlidesPanel videoId={videoId} />
      </TabsContent>
    </Tabs>
  );
}
