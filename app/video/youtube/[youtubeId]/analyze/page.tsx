import { ExternalLink } from "lucide-react";
import { AnalyzeTabs } from "@/components/analyze/analyze-tabs";
import { fetchAndSaveTranscript } from "@/lib/fetch-and-save-transcript";
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

  console.log("[AnalyzePage] 3. Fetching transcript data...");
  // Direct function call instead of workflow to work around RSC hang issue
  // See: https://github.com/vercel/workflow/issues/618
  const videoData = await fetchAndSaveTranscript(youtubeId);
  console.log("[AnalyzePage] 4. Got transcript data:", videoData.title);

  return (
    <>
      <div className="flex items-start justify-between gap-4">
        <VideoInfoDisplay
          title={videoData.title}
          channelName={videoData.channelName}
          youtubeId={youtubeId}
        />
      </div>
      <AnalyzeTabs videoId={youtubeId} />
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
