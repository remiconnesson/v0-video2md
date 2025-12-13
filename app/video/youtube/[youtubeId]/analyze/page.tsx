import { ArrowLeft, ExternalLink, RefreshCw } from "lucide-react";
import Link from "next/link";
import { getAnalysisVersions } from "@/app/actions";
import { SlidesPanel } from "@/components/analyze/slides-panel";
import { VersionSelector } from "@/components/analyze/version-selector";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { isRecord } from "@/lib/type-utils";
import {
  getSortedVersionsDescending,
  parseVersions,
} from "@/lib/versions-utils";

import { versionSearchParamsCache } from "./searchParams";

export default async function AnalyzePage(
  props: PageProps<"/video/youtube/[youtubeId]/analyze">,
) {
  const { youtubeId } = await props.params;
  const result = await getAnalysisVersions(youtubeId);

  await versionSearchParamsCache.parse(props.searchParams);
  const version = await versionSearchParamsCache.get("version");

  if (!result.success) {
    return <ErrorScreen errorMessage={result.error} />;
  }

  const versions = getSortedVersionsDescending(parseVersions(result.versions));
  const displayedVersion = version === -1 ? versions[0] : version;

  if (!versions.includes(displayedVersion)) {
    return <ErrorScreen errorMessage="Invalid version" />;
  }

  // TODO: fetch video info

  // TODO: fetch analysis or start it (cf. api)

  // display error + retry OR analysis in progress (w/ streaming) or complete analysis
  function handleReroll() {
    // TODO: navigateToNextVersion;
  }

  return (
    <Layout>
      <div className="flex items-start justify-between gap-4">
        <VideoInfoDisplay videoInfo={videoInfo} youtubeId={youtubeId} />
        <div className="flex items-center gap-3 flex-shrink-0">
          <VersionSelector
            versions={versions}
            currentVersion={displayedVersion}
          />
          <Button variant="outline" onClick={handleReroll} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Reroll
          </Button>
        </div>
        <ResultsTabs
          displayResult={displayResult}
          isAnalysisRunning={isAnalysisRunning}
          selectedRun={selectedRun}
          youtubeId={youtubeId}
          // needs to be split, we don't need to drill slides state from here,
          slidesState={slidesState}
          onSlidesStateChange={setSlidesState}
        />
      </div>
    </Layout>
  );
}

// dumb component with just a link
function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      <div className="container mx-auto px-4 py-6 max-w-5xl">
        <div className="flex items-center gap-4 mb-6">
          <Link href="/">
            <Button variant="ghost" size="sm" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Home
            </Button>
          </Link>
        </div>

        {children}
      </div>
    </div>
  );
}

function ErrorScreen({ errorMessage }: { errorMessage: string }) {
  return <div>Error: {errorMessage}</div>;
}

function VideoInfoDisplay({
  videoInfo,
  youtubeId,
}: {
  videoInfo: VideoInfo | null;
  youtubeId: string;
}) {
  return (
    <div className="min-w-0">
      <h1 className="text-2xl font-bold truncate">
        {videoInfo?.title ?? "Video Analysis"}
      </h1>

      <div className="flex items-center gap-3 mt-1">
        {videoInfo?.channelName && (
          <span className="text-sm text-muted-foreground">
            {videoInfo.channelName}
          </span>
        )}

        <a
          href={`https://www.youtube.com/watch?v=${youtubeId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"
        >
          <ExternalLink className="h-3 w-3" />
          Watch
        </a>
      </div>
    </div>
  );
}

function ResultsTabs({
  displayResult,
  isAnalysisRunning,
  selectedRun,
  youtubeId,
}: {
  displayResult: unknown;
  isAnalysisRunning: boolean;
  selectedRun: AnalysisRun | null;
  youtubeId: string;
}) {
  return (
    <Tabs defaultValue="analysis" className="space-y-4">
      <TabsList>
        <TabsTrigger value="analysis">Analysis</TabsTrigger>
        <TabsTrigger value="slides">Slides</TabsTrigger>
      </TabsList>

      <TabsContent value="analysis">
        {isRecord(displayResult) && (
          <AnalysisPanel
            analysis={displayResult}
            runId={isAnalysisRunning ? null : (selectedRun?.id ?? null)}
            videoId={youtubeId}
          />
        )}
      </TabsContent>

      <TabsContent value="slides">
        <SlidesPanel videoId={youtubeId} />
      </TabsContent>
    </Tabs>
  );
}
