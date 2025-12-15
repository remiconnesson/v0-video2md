import { ExternalLink } from "lucide-react";
import { start } from "workflow/api";
import { fetchAndSaveTranscriptWorkflow } from "@/app/workflows/fetch-and-save-transcript";
import { AnalysisPanel } from "@/components/analyze/analysis-panel";
import { SlidesPanel } from "@/components/analyze/slides-panel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { isValidYouTubeVideoId } from "@/lib/youtube-utils";

type AnalyzePageProps = {
  params: Promise<{ youtubeId: string }>;
};

export default async function AnalyzePage(props: AnalyzePageProps) {
  const { youtubeId } = await props.params;
  console.log("[AnalyzePage] 1. Start, videoId:", youtubeId);

  if (!isValidYouTubeVideoId(youtubeId)) {
    console.log("[AnalyzePage] 2. Invalid videoId");
    return <ErrorScreen errorMessage="Invalid YouTube Video ID" />;
  }

  console.log("[AnalyzePage] 3. Starting workflow...");
  const run = await start(fetchAndSaveTranscriptWorkflow, [youtubeId]);
  console.log("[AnalyzePage] 4. Workflow started, runId:", run.runId);

  console.log("[AnalyzePage] 5. Awaiting returnValue...");
  const videoData = await run.returnValue;
  console.log("[AnalyzePage] 6. Got returnValue:", videoData?.title);

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
          <AnalysisPanel videoId={youtubeId} />
        </TabsContent>

        <TabsContent value="slides">
          <SlidesPanel videoId={youtubeId} />
        </TabsContent>
      </Tabs>
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
