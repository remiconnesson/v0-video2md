import { ExternalLink } from "lucide-react";
import { start } from "workflow/api";
import { getAnalysisVersions } from "@/app/actions";
import { fetchAndSaveTranscriptWorkflow } from "@/app/workflows/fetch-and-save-transcript";
import { AnalysisPanel } from "@/components/analyze/analysis-panel";
import { SlidesPanel } from "@/components/analyze/slides-panel";
import { VersionSelector } from "@/components/analyze/version-selector";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getVersion, parseVersions } from "@/lib/versions-utils";
import { isValidYouTubeVideoId } from "@/lib/youtube-utils";
import { versionSearchParamsCache } from "./searchParams";

export default async function AnalyzePage(
  props: PageProps<"/video/youtube/[youtubeId]/analyze">,
) {
  const { youtubeId } = await props.params;

  if (!result.success) {
    return <ErrorScreen errorMessage={result.error} />;
  }

  const run = await start(fetchAndSaveTranscriptWorkflow, [youtubeId]);

  const videoData = await run.returnValue;

  return (
    <>
      <div className="flex items-start justify-between gap-4">
        <VideoInfoDisplay
          title={videoData.title}
          channelName={videoData.channelName}
          youtubeId={youtubeId}
        />
      </div>
      <Tabs defaultValue="analysis" className="space-y-4">
        <TabsList>
          <TabsTrigger value="analysis">Analysis</TabsTrigger>
          <TabsTrigger value="slides">Slides</TabsTrigger>
        </TabsList>

        <TabsContent value="analysis">
          <Analysis youtubeId={youtubeId} />
        </TabsContent>

        <TabsContent value="slides">
          <SlidesPanel videoId={youtubeId} />
        </TabsContent>
      </Tabs>
    </>
  );
}

async function Analysis({ youtubeId }: { youtubeId: string }) {
  const result = await getAnalysisVersions(youtubeId);

  if (!result.success) {
    throw new Error(result.error);
  }

  const versions = parseVersions(result.versions);

  return (
    <>
      <VersionSelector videoId={youtubeId} versions={versions} />
      <AnalysisPanel videoId={youtubeId} versions={versions} />
    </>
  );
}

function ErrorScreen({ errorMessage }: { errorMessage: string }) {
  return <div>Error: {errorMessage}</div>;
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
      <h1 className="text-2xl font-bold truncate">{title}</h1>

      <div className="flex items-center gap-3 mt-1">
        <span className="text-sm text-muted-foreground">{channelName}</span>

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
